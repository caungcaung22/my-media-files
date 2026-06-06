/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AdditionalWork {
  id: string;
  date: string;
  name: string;
  amount: number;
}

export interface SchedulePhase {
  name: string;
  start: string;
  end: string;
}

export interface ProjectSettings {
  projectName: string;
  contractValue: number;
  additionalWorks: AdditionalWork[];
  officeBudget: number;
  clientName: string;
  projectAddress: string;
  contractDate: string;
  clientPhone: string;
  startDate: string;
  endDate: string;
  schedule: string;
  schedulePhases: SchedulePhase[];
}

export interface Project {
  id: string;
  projectName: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  original_amount?: number;
  item: string;
  stage: string;
  name: string;
  job_type?: string;
  entry_type?: string;
  remark: string;
  projectId: string;
  receiver?: string;
  qty?: number | string;
  unit_price?: number | string;
  transport_charges?: number;
  additional_charges?: number;
  status?: string;
  purchase_for?: string;
  site_name?: string;
  purchase_source?: string;
  timestamp?: string;
  running_balance?: number;
  category: string;
  type: string;
  flow_type?: 'IN' | 'OUT' | string;
  particular?: string;
  employeeName?: string;
  employeePhone?: string;
  transferAccount?: string;
  linkedTransactionId?: string;
  subcon_name_ref?: string;
}

export interface SourcingRequest {
  id: string;
  item_name: string;
  qty: string;
  needed_date: string;
  deadline_date?: string;
  requested_by: string;
  status: string;
  remark: string;
  image_url?: string;
  projectId: string;
  timestamp?: string;
}

export interface DataCollection {
  id: string;
  type: 'subcon_price' | 'material_price' | 'shop' | 'office_material';
  name: string;
  price?: number;
  unit?: string;
  remark?: string;
  phone?: string;
  address?: string;
  stockIn?: number;
  stockOut?: number;
  issuedBy?: string;
  receivedBy?: string;
  date?: string;
  isReturnable?: boolean;
  returnStatus?: string;
  linkedTransactionId?: string;
  timestamp?: string;
  updatedAt?: string;
}

export interface SubconQuotationItem {
  id: string;
  item: string;
  qty: number | string;
  unit_price: number | string;
  amount: number;
  original_amount: number;
  discount: number;
  work_type: string;
}

export interface Employee {
  id: string;
  name: string;
  position?: string;
  contractAmount?: number;
  additionalWorks?: AdditionalWork[];
  quotationItems?: SubconQuotationItem[];
  projectId: string; // 'global' or project id
  remark?: string;
}

export interface ClientClaimItem {
  name: string;
  qty: number;
  price: number;
  total: number;
}

export interface ClientClaim {
  id: string;
  date: string;
  transport_charges: number;
  service_fee: number;
  status: string;
  remark: string;
  items: ClientClaimItem[];
  total_claim_amount: number;
  projectId: string;
  timestamp?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  dueDate: string;
  status: 'Pending' | 'Completed';
  projectId: string;
  timestamp?: string;
}
