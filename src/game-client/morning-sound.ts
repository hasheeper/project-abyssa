/** Small offline foley placeholders. Starts only after a gesture; no BGM, looping source or network audio. */
export function createMorningSound() {
  let context:AudioContext|undefined;
  const active=new Set<AudioScheduledSourceNode>();
  function unlock(){
    if(typeof AudioContext==="undefined") return;
    context??=new AudioContext();
    if(context.state==="suspended") void context.resume().catch(()=>{});
  }
  function play(kind:"wood"|"metal"|"glass"|"cloth"|"ceramic") {
    const ctx=context;
    if(!ctx || ctx.state!=="running" || document.hidden) return;
    const sources:AudioScheduledSourceNode[]=[];
    const nodes:AudioNode[]=[];
    const time=ctx.currentTime;
    const ring=(frequency:number,gain:number,decay:number,delay=0)=> {
      const source=ctx.createOscillator(),envelope=ctx.createGain();
      source.type="sine";source.frequency.value=frequency;
      envelope.gain.setValueAtTime(.0001,time+delay);envelope.gain.exponentialRampToValueAtTime(gain,time+delay+.003);envelope.gain.exponentialRampToValueAtTime(.0001,time+delay+decay);
      source.connect(envelope).connect(ctx.destination);source.start(time+delay);source.stop(time+delay+decay+.02);
      sources.push(source);nodes.push(envelope);
    };
    if(kind==="metal") [790,1229,2021].forEach((hz,i)=>ring(hz,.012/(i+1),.18+i*.05));
    if(kind==="ceramic") [1180,1841].forEach((hz,i)=>ring(hz,.015/(i+1),.14+i*.035));
    if(kind==="glass") [913,1381,2093,2797,3511].forEach((hz,i)=>ring(hz,.011/(i+1),.22+i*.07,i*.014));
    const duration=kind==="glass"?.48:kind==="cloth"?.3:.12;
    const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);
    let seed=1729;
    for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=(seed/4294967296*2-1)*Math.exp(-i/(data.length*.15));}
    const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),volume=ctx.createGain();
    noise.buffer=buffer;filter.type="lowpass";filter.frequency.value=kind==="glass"?4300:kind==="cloth"?800:kind==="wood"?460:1800;
    volume.gain.value=kind==="glass"?.08:kind==="wood"?.09:.025;
    noise.connect(filter).connect(volume).connect(ctx.destination);noise.start();sources.push(noise);nodes.push(filter,volume);
    for(const source of sources){active.add(source);source.onended=()=>{active.delete(source);source.disconnect();};}
    const cleanup=()=>{for(const source of sources){try{source.stop();}catch{}active.delete(source);source.disconnect();}nodes.forEach(node=>node.disconnect());};
    const timeout=setTimeout(cleanup,800);
    return ()=>{clearTimeout(timeout);cleanup();};
  }
  return {unlock,play,close:()=>{active.forEach(source=>{try{source.stop();}catch{}});active.clear();void context?.close().catch(()=>{});}};
}
