// Keep Phoenix/Supabase realtime handshakes inside the synthetic browser context.
export async function installOfflineSockets(context){
 await context.routeWebSocket('**/*',socket=>{
  socket.onMessage(message=>{
   let packet;try{packet=JSON.parse(String(message));}catch{return;}
   const array=Array.isArray(packet),topic=array?packet[2]:packet.topic,event=array?packet[3]:packet.event,payload=(array?packet[4]:packet.payload)||{},ref=array?packet[1]:packet.ref,joinRef=array?packet[0]:packet.join_ref;
   if(event!=='phx_join'&&event!=='heartbeat')return;
   const response=event==='phx_join'?{postgres_changes:(payload.config?.postgres_changes||[]).map((binding,index)=>({...binding,id:index+1}))}:{};
   const body={status:'ok',response};socket.send(JSON.stringify(array?[joinRef,ref,topic,'phx_reply',body]:{topic,event:'phx_reply',payload:body,ref,join_ref:joinRef}));
  });
 });
}
