import {describe,expect,it} from "vitest";import {parseEmployeeImport} from "../src/domain/import-pipeline.js";
import{readFile}from"node:fs/promises";import ExcelJS from"exceljs";
const csv=`internalEmployeeId,displayName,workEmail,department,position,employmentStatus,employmentCategory,startDate,contractExpirationDate\nS-1,Synthetic Person,person@example.invalid,Ops,Associate,active,full_time,2030-01-01,\n`;
describe("employee import parser",()=>{
 it("detects headers and normalizes a CSV preview",async()=>{const p=await parseEmployeeImport(Buffer.from(csv),"employees.csv",1_000_000);expect(p.validRows).toBe(1);expect(p.invalidRows).toBe(0);expect(p.rows[0]?.value?.workEmail).toBe("person@example.invalid");});
 it("rejects mismatched and traversal-like types",async()=>{await expect(parseEmployeeImport(Buffer.from("not pdf"),"../../employees.pdf",1_000_000)).rejects.toThrow();});
 it("parses the visually verified synthetic XLSX fixture",async()=>{const p=await parseEmployeeImport(await readFile(new URL("../samples/synthetic-employees.xlsx",import.meta.url)),"synthetic-employees.xlsx",2_000_000);expect(p.validRows).toBe(4);expect(p.invalidRows).toBe(0);});
 it("rejects XLSX formulas instead of evaluating cached content",async()=>{const book=new ExcelJS.Workbook();const sheet=book.addWorksheet("Employees");sheet.addRow(["internalEmployeeId","displayName","workEmail","department","position","employmentStatus","employmentCategory","startDate","contractExpirationDate"]);sheet.addRow([{formula:"1+1",result:2},"Synthetic Person","person@example.invalid","Ops","Associate","active","full_time","2030-01-01",""]);const bytes=await book.xlsx.writeBuffer();await expect(parseEmployeeImport(Buffer.from(bytes),"employees.xlsx",2_000_000)).rejects.toThrow(/formulas/i);});
});
