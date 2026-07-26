import pg from "pg";
import {loadConfig} from "../src/config.js";
import {hashPassword} from "../src/domain/session.js";

const config=loadConfig(); const pool=new pg.Pool({connectionString:config.DATABASE_URL});
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
    await client.query(`INSERT INTO employees(id,tenant_id,membership_id,internal_employee_id,display_name,work_email,department_id,position,employment_status,employment_category,start_date)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'active','full_time','2029-01-15') ON CONFLICT(tenant_id,id) DO UPDATE SET display_name=excluded.display_name,position=excluded.position`,[employeeId,tenant.id,membershipId,employeeCode,name,email,departmentId,position]);
   }
   const manager=tenant.users.find((u)=>u[5]==="manager")!; const employee=tenant.users.find((u)=>u[5]==="employee")!;
   await client.query(`INSERT INTO reporting_relationships(tenant_id,manager_employee_id,report_employee_id,starts_on) VALUES($1,$2,$3,'2029-01-15') ON CONFLICT DO NOTHING`,[tenant.id,manager[2],employee[2]]);
   await client.query("COMMIT");
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
 }
 console.log("Seeded two synthetic tenants. Demo password: Synthetic-Demo-Only-Change-Me! (development only)");
}finally{await pool.end();}
