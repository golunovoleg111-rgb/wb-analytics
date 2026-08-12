export const BJOB_MODULES={
  data:{imports:true,wbApi:true,localStore:true},
  catalog:{products:true,variants:true,manualCreation:true},
  analytics:{sales:true,competitors:true,pricing:true,spp:true,unitEconomics:true,advertising:true},
  logistics:{warehouses:true,containers:true,pallets:true,boxes:true,shipments:true,movements:true},
  fbs:{orders:true,scanner:true,stickers:true,packing:true,shipping:true},
  finance:{unitEconomics:true,expenses:true,tariffs:true,discounts:true},
  production:{planning:true,requests:true},
  reports:{export:true,generation:true},
  workspace:{users:true,roles:true,files:true},
  integrations:{tekser:true,printers:true,datamatrix:true},
  intelligence:{assistant:true}
};
export const PRODUCT_FIELDS=['name','article','size','color','fabric','tnved','barcode','price','purchasePrice','commission','logisticsCost','storageCost','adCost','packagingCost','otherExpenses'];
export const WORKFLOW=['create_workspace','connect_wb','import_or_sync','create_product','configure_unit_economics','create_warehouse','receive_or_move_stock','plan_production','process_fbs','analyze','generate_report'];
