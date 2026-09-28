export function mapPointer(clientX,clientY,rect){
  if(rect.width<=0||rect.height<=0)return null;
  const x=(clientX-rect.left)*960/rect.width,y=(clientY-rect.top)*540/rect.height;
  return x<0||x>960||y<0||y>540?null:{x,y};
}
export function createPointerSession(){
  let active=null;
  return {
    begin(id){if(active!==null)return false;active=id;return true;},
    owns(id){return active===id;},
    end(id){if(active!==id)return 'ignore';active=null;return 'release';},
    cancel(id=active){if(active===null||active!==id)return 'ignore';active=null;return 'cancel';}
  };
}
