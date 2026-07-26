import {posix as path} from "node:path";
import {XMLParser} from "fast-xml-parser";
import yauzl, {type Entry, type ZipFile} from "yauzl";

export interface XlsxSheet {
  name:string;
  rows:unknown[][];
}

const MAX_ENTRIES=200;
const MAX_UNCOMPRESSED_BYTES=32*1024*1024;
const MAX_ENTRY_BYTES=16*1024*1024;
const MAX_ROWS_PER_SHEET=20_000;
const MAX_COLUMNS=512;

const parser=new XMLParser({
  ignoreAttributes:false,
  attributeNamePrefix:"",
  textNodeName:"#text",
  parseTagValue:false,
  parseAttributeValue:false,
  trimValues:false,
  processEntities:false,
});

function asRecord(value:unknown):Record<string,unknown>{
  return value!==null&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
}

function asArray(value:unknown):unknown[]{
  return value===undefined?[]:Array.isArray(value)?value:[value];
}

function decodeXmlText(value:string):string{
  return value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi,match=>{
    const token=match.slice(1,-1).toLowerCase();
    if(token==="amp")return "&";if(token==="lt")return "<";if(token==="gt")return ">";if(token==="quot")return '"';if(token==="apos")return "'";
    const code=token.startsWith("#x")?Number.parseInt(token.slice(2),16):Number.parseInt(token.slice(1),10);
    return Number.isInteger(code)&&code>=0&&code<=0x10ffff?String.fromCodePoint(code):match;
  });
}

function xmlText(value:unknown):string{
  if(value===undefined||value===null)return "";
  if(typeof value!=="object")return decodeXmlText(String(value));
  if(Array.isArray(value))return value.map(xmlText).join("");
  const object=asRecord(value);
  if("#text" in object)return xmlText(object["#text"]);
  if("t" in object)return xmlText(object.t);
  if("r" in object)return asArray(object.r).map(xmlText).join("");
  return "";
}

function openZip(buffer:Buffer):Promise<ZipFile>{
  return new Promise((resolve,reject)=>{
    yauzl.fromBuffer(buffer,{lazyEntries:true,validateEntrySizes:true},(error,zip)=>{
      if(error||!zip)reject(error??new Error("Could not open XLSX archive"));
      else resolve(zip);
    });
  });
}

function isRelevantEntry(name:string):boolean{
  return name==="xl/workbook.xml"||name==="xl/_rels/workbook.xml.rels"||name==="xl/sharedStrings.xml"||name.startsWith("xl/worksheets/");
}

function readEntry(zip:ZipFile,entry:Entry):Promise<Buffer>{
  return new Promise((resolve,reject)=>{
    zip.openReadStream(entry,(error,stream)=>{
      if(error||!stream){reject(error??new Error("Could not read XLSX entry"));return;}
      const chunks:Buffer[]=[];let size=0;
      stream.on("data",(chunk:Buffer)=>{
        size+=chunk.length;
        if(size>MAX_ENTRY_BYTES)stream.destroy(new Error("XLSX entry exceeds the extraction limit"));
        else chunks.push(chunk);
      });
      stream.once("error",reject);
      stream.once("end",()=>resolve(Buffer.concat(chunks,size)));
    });
  });
}

async function readArchive(buffer:Buffer):Promise<Map<string,Buffer>>{
  const zip=await openZip(buffer);
  const selected=new Map<string,Buffer>();
  let entryCount=0;let totalSize=0;
  return new Promise((resolve,reject)=>{
    let settled=false;
    const fail=(error:unknown)=>{
      if(settled)return;
      settled=true;zip.close();reject(error instanceof Error?error:new Error(String(error)));
    };
    zip.once("error",fail);
    zip.once("end",()=>{if(!settled){settled=true;resolve(selected);}});
    zip.on("entry",entry=>{
      void (async()=>{
        entryCount+=1;totalSize+=entry.uncompressedSize;
        const parts=entry.fileName.split("/");
        if(entryCount>MAX_ENTRIES)throw new Error("XLSX archive contains too many entries");
        if(totalSize>MAX_UNCOMPRESSED_BYTES)throw new Error("XLSX archive expands beyond the safety limit");
        if(entry.uncompressedSize>MAX_ENTRY_BYTES)throw new Error("XLSX entry exceeds the extraction limit");
        if(entry.fileName.startsWith("/")||entry.fileName.includes("\\")||parts.includes(".."))throw new Error("XLSX archive contains an unsafe path");
        if((entry.generalPurposeBitFlag&1)!==0)throw new Error("Encrypted XLSX files are not supported");
        if(isRelevantEntry(entry.fileName)&&!entry.fileName.endsWith("/"))selected.set(entry.fileName,await readEntry(zip,entry));
        zip.readEntry();
      })().catch(fail);
    });
    zip.readEntry();
  });
}

function parseXml(buffer:Buffer|undefined,label:string):Record<string,unknown>{
  if(!buffer)throw new Error(`XLSX is missing ${label}`);
  return asRecord(parser.parse(buffer.toString("utf8"),true));
}

function sharedStrings(entries:Map<string,Buffer>):string[]{
  const source=entries.get("xl/sharedStrings.xml");if(!source)return[];
  const document=parseXml(source,"shared strings");
  return asArray(asRecord(document.sst).si).map(xmlText);
}

function columnIndex(reference:unknown,fallback:number):number{
  if(typeof reference!=="string")return fallback;
  const match=/^([A-Z]+)\d+$/i.exec(reference);if(!match?.[1])return fallback;
  let value=0;for(const character of match[1].toUpperCase())value=value*26+character.charCodeAt(0)-64;
  return value-1;
}

function parseCell(cell:Record<string,unknown>,strings:string[]):unknown{
  if(Object.hasOwn(cell,"f"))throw new Error("Spreadsheet formulas are not accepted; upload values only");
  const type=typeof cell.t==="string"?cell.t:"";
  if(type==="inlineStr")return xmlText(cell.is);
  const raw=xmlText(cell.v);
  if(type==="s")return strings[Number.parseInt(raw,10)]??"";
  if(type==="b")return raw==="1";
  if(type==="str"||type==="e"||type==="d")return raw;
  if(raw==="")return "";
  const numeric=Number(raw);return Number.isFinite(numeric)?numeric:raw;
}

function parseRows(source:Buffer,strings:string[]):unknown[][]{
  const document=parseXml(source,"worksheet");
  const rows=asArray(asRecord(asRecord(document.worksheet).sheetData).row);
  if(rows.length>MAX_ROWS_PER_SHEET)throw new Error("Worksheet exceeds the row limit");
  return rows.map(rowValue=>{
    const cells=asArray(asRecord(rowValue).c);const row:unknown[]=[];
    cells.forEach((cellValue,index)=>{
      const cell=asRecord(cellValue);const column=columnIndex(cell.r,index);
      if(column<0||column>=MAX_COLUMNS)throw new Error("Worksheet exceeds the column limit");
      while(row.length<column)row.push("");
      row[column]=parseCell(cell,strings);
    });
    return row;
  }).filter(row=>row.some(value=>value!==""&&value!==undefined&&value!==null));
}

function resolveTarget(target:string):string{
  const resolved=target.startsWith("/")?path.normalize(target.slice(1)):path.normalize(path.join("xl",target));
  if(!resolved.startsWith("xl/"))throw new Error("XLSX relationship points outside the workbook");
  return resolved;
}

export async function readXlsx(buffer:Buffer,maxSheets=20):Promise<XlsxSheet[]>{
  const entries=await readArchive(buffer);
  const workbook=parseXml(entries.get("xl/workbook.xml"),"workbook metadata");
  const relationships=parseXml(entries.get("xl/_rels/workbook.xml.rels"),"workbook relationships");
  const relationMap=new Map<string,string>();
  for(const raw of asArray(asRecord(relationships.Relationships).Relationship)){
    const relation=asRecord(raw);
    if(typeof relation.Id==="string"&&typeof relation.Target==="string"&&relation.TargetMode!=="External")relationMap.set(relation.Id,resolveTarget(relation.Target));
  }
  const strings=sharedStrings(entries);
  const sheets=asArray(asRecord(asRecord(workbook.workbook).sheets).sheet);
  if(!sheets.length)throw new Error("Workbook has no worksheet");
  return sheets.slice(0,maxSheets).map((raw,index)=>{
    const sheet=asRecord(raw);const relationId=sheet["r:id"];
    if(typeof relationId!=="string")throw new Error("Worksheet relationship is missing");
    const target=relationMap.get(relationId);if(!target)throw new Error("Worksheet relationship is invalid");
    const source=entries.get(target);if(!source)throw new Error("Worksheet data is missing");
    return {name:typeof sheet.name==="string"?sheet.name:`Sheet ${index+1}`,rows:parseRows(source,strings)};
  });
}
