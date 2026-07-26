import pg from "pg";
import {loadConfig} from "../src/config.js";
import {hashPassword} from "../src/domain/session.js";
import {LocalObjectStorage} from "../src/adapters/local-storage.js";

const config=loadConfig(); const pool=new pg.Pool({connectionString:config.DATABASE_URL});
const storage=new LocalObjectStorage(config.STORAGE_ROOT);
const password=await hashPassword("Synthetic-Demo-Only-Change-Me!");
const tenants=[
 {id:"10000000-0000-4000-8000-000000000001",slug:"northstar",name:"Northstar Café Group",timezone:"America/Vancouver",users:[
  ["11000000-0000-4000-8000-000000000001","12000000-0000-4000-8000-000000000001","13000000-0000-4000-8000-000000000001","avery.morgan@northstar.example.invalid","Avery Morgan","employee","NS-100","Cafe Associate"],
  ["11000000-0000-4000-8000-000000000002","12000000-0000-4000-8000-000000000002","13000000-0000-4000-8000-000000000002","jordan.lee@northstar.example.invalid","Jordan Lee","manager","NS-101","Shift Manager"],
  ["11000000-0000-4000-8000-000000000003","12000000-0000-4000-8000-000000000003","13000000-0000-4000-8000-000000000003","riley.chen@northstar.example.invalid","Riley Chen","hr","NS-102","HR Coordinator"],
  ["11000000-0000-4000-8000-000000000004","12000000-0000-4000-8000-000000000004","13000000-0000-4000-8000-000000000004","casey.bennett@northstar.example.invalid","Casey Bennett","owner","NS-103","Owner"]]},
 {id:"20000000-0000-4000-8000-000000000001",slug:"cedar",name:"Cedar Property Services",timezone:"America/Vancouver",users:[
  ["21000000-0000-4000-8000-000000000001","22000000-0000-4000-8000-000000000001","23000000-0000-4000-8000-000000000001","avery.morgan@cedar.example.invalid","Avery Morgan","employee","CP-100","Property Technician"],
  ["21000000-0000-4000-8000-000000000002","22000000-0000-4000-8000-000000000002","23000000-0000-4000-8000-000000000002","jordan.lee@cedar.example.invalid","Jordan Lee","manager","CP-101","Service Manager"],
  ["21000000-0000-4000-8000-000000000003","22000000-0000-4000-8000-000000000003","23000000-0000-4000-8000-000000000003","riley.chen@cedar.example.invalid","Riley Chen","hr","CP-102","Operations Coordinator"]]}
] as const;
try{
 for(const tenant of tenants){
  const client=await pool.connect(); try{
   await client.query("BEGIN");
   await client.query(`INSERT INTO tenants(id,slug,name,timezone,synthetic_only) VALUES($1,$2,$3,$4,true) ON CONFLICT(id) DO UPDATE SET name=excluded.name,timezone=excluded.timezone`,[tenant.id,tenant.slug,tenant.name,tenant.timezone]);
   await client.query("SELECT set_config('app.tenant_id',$1,true)",[tenant.id]);
   const departmentId=tenant.slug==="northstar"?"14000000-0000-4000-8000-000000000001":"24000000-0000-4000-8000-000000000001";
   await client.query(`INSERT INTO departments(id,tenant_id,name) VALUES($1,$2,$3) ON CONFLICT(tenant_id,id) DO NOTHING`,[departmentId,tenant.id,tenant.slug==="northstar"?"Operations":"Field Operations"]);
   for(const [userId,membershipId,employeeId,email,name,role,employeeCode,position] of tenant.users){
    await client.query(`INSERT INTO users(id,email,password_hash,display_name) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash`,[userId,email,password,name]);
    await client.query(`INSERT INTO memberships(id,tenant_id,user_id) VALUES($1,$2,$3) ON CONFLICT(tenant_id,id) DO NOTHING`,[membershipId,tenant.id,userId]);
    await client.query(`INSERT INTO membership_roles(tenant_id,membership_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[tenant.id,membershipId,role]);
    if(role==="owner"||(tenant.slug==="cedar"&&role==="hr"))await client.query(`INSERT INTO membership_roles(tenant_id,membership_id,role) VALUES($1,$2,'tenant_admin') ON CONFLICT DO NOTHING`,[tenant.id,membershipId]);
    await client.query(`INSERT INTO employees(id,tenant_id,membership_id,internal_employee_id,display_name,work_email,department_id,position,employment_status,employment_category,start_date)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'active','full_time','2029-01-15') ON CONFLICT(tenant_id,id) DO UPDATE SET display_name=excluded.display_name,position=excluded.position`,[employeeId,tenant.id,membershipId,employeeCode,name,email,departmentId,position]);
   }
   const manager=tenant.users.find((u)=>u[5]==="manager")!; const employee=tenant.users.find((u)=>u[5]==="employee")!;
   await client.query(`INSERT INTO reporting_relationships(tenant_id,manager_employee_id,report_employee_id,starts_on) VALUES($1,$2,$3,'2029-01-15') ON CONFLICT DO NOTHING`,[tenant.id,manager[2],employee[2]]);
   const deadlineId=tenant.slug==="northstar"?"15000000-0000-4000-8000-000000000001":"25000000-0000-4000-8000-000000000001";
   await client.query(`INSERT INTO deadlines(id,tenant_id,employee_id,type,title,due_at,state,source_type) VALUES($1,$2,$3,'training','Synthetic safety training renewal',now()+interval '30 days','open','workflow_rule') ON CONFLICT(tenant_id,id) DO UPDATE SET due_at=excluded.due_at,state='open'`,[deadlineId,tenant.id,employee[2]]);
   const documentId=tenant.slug==="northstar"?"16000000-0000-4000-8000-000000000001":"26000000-0000-4000-8000-000000000001";const versionId=tenant.slug==="northstar"?"17000000-0000-4000-8000-000000000001":"27000000-0000-4000-8000-000000000001";const admin=tenant.users.find(u=>u[5]==="owner")??tenant.users.find(u=>u[5]==="hr")!;const policy=`Synthetic Sick Leave Policy\nIf an employee cannot work because they are sick, they should contact their manager before the scheduled shift using the approved team contact method. The employee should state that they cannot attend and provide an expected return date if known. Do not include detailed medical information. If the absence continues, contact HR for the next approved step.`;const storageKey=`tenant/${tenant.id}/documents/${documentId}/versions/${versionId}/original`;
   try{await storage.put(storageKey,Buffer.from(policy));}catch(error){if(!(error&&typeof error==="object"&&"code"in error&&error.code==="EEXIST"))throw error;}
   await client.query(`INSERT INTO documents(id,tenant_id,title,audience_roles) VALUES($1,$2,'Synthetic Sick Leave Policy',ARRAY['employee','manager','hr','owner','tenant_admin']::tenant_role[]) ON CONFLICT(tenant_id,id) DO NOTHING`,[documentId,tenant.id]);
   await client.query(`INSERT INTO document_versions(id,tenant_id,document_id,version,state,is_current,original_filename,storage_key,media_type,sha256,size_bytes,uploaded_by,approved_by,approved_at) VALUES($1,$2,$3,1,'approved',true,'synthetic-sick-leave.csv',$4,'text/csv',encode(digest($5,'sha256'),'hex'),octet_length($5),$6,$6,now()) ON CONFLICT(tenant_id,id) DO NOTHING`,[versionId,tenant.id,documentId,storageKey,policy,admin[1]]);
   await client.query(`INSERT INTO document_sections(id,tenant_id,document_version_id,ordinal,heading,page_number,content) VALUES(gen_random_uuid(),$1,$2,0,'Calling in sick',1,$3) ON CONFLICT(tenant_id,document_version_id,ordinal) DO NOTHING`,[tenant.id,versionId,policy]);
   await client.query("COMMIT");
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
 }
 console.log("Seeded two synthetic tenants. Demo password: Synthetic-Demo-Only-Change-Me! (development only)");
}finally{await pool.end();}
