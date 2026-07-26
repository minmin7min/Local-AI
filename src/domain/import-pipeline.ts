import {createHash,randomUUID} from "node:crypto";
import ExcelJS from "exceljs";
import {parse as parseCsv} from "csv-parse/sync";
import {requirePermission,type Principal} from "./authz.js";
import {validateRows,type RowResult} from "./imports.js";
import {validateUpload} from "./documents.js";

const canonical=["internalEmployeeId","displayName","workEmail","department","position","employmentStatus","employmentCategory","startDate","contractExpirationDate"] as const;
export interface ImportPreview {id:string;filename:string;sha256:string;headers:string[];rows:RowResult[];validRows:number;invalidRows:number;status:"preview"|"committed"}
export interface ImportCommit {batchId:string;created:number;skipped:number;alreadyCommitted:boolean}
export interface ImportRepository {savePreview(principal:Principal,preview:ImportPreview):Promise<ImportPreview>;findPreview(principal:Principal,id:string):Promise<ImportPreview|undefined>;commit(principal:Principal,id:string):Promise<ImportCommit|undefined>}
function normalizeDate(value:unknown):string|undefined{
 if(value instanceof Date&&!Number.isNaN(value.valueOf()))return value.toISOString().slice(0,10);
 if(typeof value==="number"){const date=new Date(Date.UTC(1899,11,30)+value*86_400_000);if(!Number.isNaN(date.valueOf()))return date.toISOString().slice(0,10);}
 if(typeof value==="string"){const text=value.trim();if(/^\d{4}-\d{2}-\d{2}$/.test(text))return text;}
 return undefined;
}
export async function parseEmployeeImport(buffer:Buffer,filename:string,maxBytes:number):Promise<Omit<ImportPreview,"id"|"status">>{
 const valid=await validateUpload(buffer,filename,maxBytes);let matrix:unknown[][]=[];
 if(valid.mediaType==="text/csv")matrix=parseCsv(buffer,{bom:true,skip_empty_lines:true,relax_column_count:true}) as unknown[][];
 else{const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer as any);const sheet=workbook.worksheets[0];if(!sheet)throw new Error("Workbook has no worksheet");sheet.eachRow({includeEmpty:false},row=>{const values:unknown[]=[];for(let column=1;column<=sheet.actualColumnCount;column++){const value=row.getCell(column).value;if(value&&typeof value==="object"&&("formula"in value||"sharedFormula"in value))throw new Error("Spreadsheet formulas are not accepted; upload values only");values.push(value??"");}matrix.push(values);});}
 if(matrix.length<2)throw new Error("The import must contain a header and at least one row");
 let headerIndex=-1;let best=0;for(let i=0;i<Math.min(matrix.length,10);i++){const score=(matrix[i]??[]).map(v=>String(v).trim()).filter(v=>(canonical as readonly string[]).includes(v)).length;if(score>best){best=score;headerIndex=i;}}
 if(headerIndex<0||best<7)throw new Error("Could not find the required employee header row");
 const headers=(matrix[headerIndex]??[]).map(v=>String(v).trim());
 const records=matrix.slice(headerIndex+1).map(row=>Object.fromEntries(canonical.flatMap(key=>{const value=(row as unknown[])[headers.indexOf(key)];const normalized=key.endsWith("Date")?normalizeDate(value)??String(value??"").trim():String(value??"").trim();return key==="contractExpirationDate"&&!normalized?[]:[[key,normalized]];})));
 const rows=validateRows(records);return {filename,sha256:createHash("sha256").update(buffer).digest("hex"),headers,rows,validRows:rows.filter(r=>r.errors.length===0).length,invalidRows:rows.filter(r=>r.errors.length>0).length};
}
export class ImportService{
 constructor(private readonly repository:ImportRepository,private readonly maxBytes:number){}
 async preview(principal:Principal,buffer:Buffer,filename:string){requirePermission(principal,"import:manage");const parsed=await parseEmployeeImport(buffer,filename,this.maxBytes);return this.repository.savePreview(principal,{id:randomUUID(),status:"preview",...parsed});}
 async get(principal:Principal,id:string){requirePermission(principal,"import:manage");return this.repository.findPreview(principal,id);}
 async commit(principal:Principal,id:string){requirePermission(principal,"import:manage");const batch=await this.repository.findPreview(principal,id);if(!batch)return undefined;if(batch.invalidRows>0)throw new Error("Correct all row errors before committing the import");return this.repository.commit(principal,id);}
}
