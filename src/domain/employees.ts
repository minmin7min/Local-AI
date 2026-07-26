import {authorizeEmployeeRead} from "./scope.js";
import {requirePermission,type Principal} from "./authz.js";

export interface EmployeeView {id:string;tenantId:string;membershipId?:string;internalEmployeeId:string;displayName:string;workEmail:string;departmentId:string;departmentName:string;position:string;employmentStatus:string;employmentCategory:string;startDate:string;contractExpirationDate?:string;onboardingStatus:string;offboardingStatus:string;updatedAt:string;managerEmployeeIds:string[]}
export interface EmployeeUpdate {departmentId?:string|undefined;position?:string|undefined;employmentStatus?:"active"|"leave"|"ended"|undefined;employmentCategory?:"full_time"|"part_time"|"contract"|"temporary"|undefined;contractExpirationDate?:string|null|undefined;onboardingStatus?:string|undefined;offboardingStatus?:string|undefined;expectedVersion:number}
export interface EmployeeRepository {listAuthorized(principal:Principal):Promise<EmployeeView[]>;findById(principal:Principal,id:string):Promise<EmployeeView|undefined>;update(principal:Principal,id:string,change:EmployeeUpdate):Promise<EmployeeView|undefined>}
export class EmployeeService{
 constructor(private readonly repository:EmployeeRepository){}
 async list(principal:Principal){return this.repository.listAuthorized(principal);}
 async get(principal:Principal,id:string){const employee=await this.repository.findById(principal,id);if(!employee)return undefined;authorizeEmployeeRead(principal,employee);return projectEmployee(employee);}
 async update(principal:Principal,id:string,change:EmployeeUpdate){requirePermission(principal,"employee:write");const employee=await this.repository.update(principal,id,change);return employee?projectEmployee(employee):undefined;}
}
export function projectEmployee(employee:EmployeeView){const {managerEmployeeIds:_,tenantId:__,membershipId:___,...safe}=employee;return safe;}
