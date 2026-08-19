const enc = value => btoa(unescape(encodeURIComponent(JSON.stringify(value))));

export function qrPayload(type,id){ return `BJOB:${type}:${id}`; }

export function qrSvg(type,id,size=180){
  const payload=qrPayload(type,id);
  const hash=[...enc(payload)].reduce((a,c)=>(a*31+c.charCodeAt(0))%1000003,7);
  const cells=21, cell=size/cells;
  let rects='';
  for(let y=0;y<cells;y++) for(let x=0;x<cells;x++){
    const finder=(x<7&&y<7)||(x>=14&&y<7)||(x<7&&y>=14);
    const border=finder&&((x%7===0)||(y%7===0)||(x%7===6)||(y%7===6));
    const center=finder&&(x%7>=2&&x%7<=4&&y%7>=2&&y%7<=4);
    const bit=((hash + x*97 + y*193 + x*y*17) % 11)<5;
    if(border||center||(!finder&&bit)) rects+=`<rect x="${x*cell}" y="${y*cell}" width="${cell}" height="${cell}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="QR ${payload}"><rect width="100%" height="100%" fill="white"/>${rects}</svg>`;
}
