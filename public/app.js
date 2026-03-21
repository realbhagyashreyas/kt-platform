const{useState,useEffect,useCallback,useRef,useMemo}=React;

async function api(path,opts={}){
  const isForm=opts.body instanceof FormData;
  const res=await fetch(`/api${path}`,{
    headers:isForm?{}:{'Content-Type':'application/json'},...opts,
    body:isForm?opts.body:opts.body?JSON.stringify(opts.body):undefined
  });
  return res.json();
}

const COLORS={role:'#f59e0b',app:'#06b6d4',program:'#10b981',table:'#8b5cf6'};
const COLORS_LIGHT={role:'#fbbf24',app:'#22d3ee',program:'#34d399',table:'#a78bfa'};
const COLORS_BG={role:'rgba(245,158,11,0.12)',app:'rgba(6,182,212,0.12)',program:'rgba(16,185,129,0.12)',table:'rgba(139,92,246,0.12)'};
const TYPE_LABELS={role:'Business Role',app:'Application',application:'Application',program:'Program',table:'DB2 Table'};
const TAG_CLS={role:'tag-role',app:'tag-app',application:'tag-app',program:'tag-prog',table:'tag-tbl',prog:'tag-prog'};

const ICONS={
  role:'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 10c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z',
  app:'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  program:'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z',
  table:'M3 3v18h18V3H3zm7 2h4v4h-4V5zm0 6h4v4h-4v-4zm-5-6h4v4H5V5zm0 6h4v4H5v-4zm0 6h4v2H5v-2zm5 0h4v2h-4v-2zm9 2h-4v-2h4v2zm0-4h-4v-4h4v4zm0-6h-4V5h4v4z'
};

function App(){
  const[user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem('kt_user'))}catch{return null}});
  const login=u=>{localStorage.setItem('kt_user',JSON.stringify(u));setUser(u)};
  const logout=()=>{localStorage.removeItem('kt_user');setUser(null)};
  if(!user)return <LoginPage onLogin={login}/>;
  return <GraphApp user={user} onLogout={logout}/>;
}

function LoginPage({onLogin}){
  const[tab,setTab]=useState('login');
  const[f,setF]=useState({username:'',password:'',display_name:'',user_type:'new_joiner'});
  const[err,setErr]=useState('');
  const submit=async e=>{
    e.preventDefault();setErr('');
    if(tab==='login'){
      const r=await api('/auth/login',{method:'POST',body:{username:f.username,password:f.password}});
      r.error?setErr(r.error):onLogin(r);
    }else{
      if(!f.display_name){setErr('Display name required');return}
      const r=await api('/auth/register',{method:'POST',body:f});
      r.error?setErr(r.error):onLogin(r);
    }
  };
  return(
    <div className="login-page">
      <div className="canvas-bg"><div className="grid-pattern"></div></div>
      <div className="login-card fade-in">
        <h1>⬡ KT Platform</h1>
        <p className="sub">Mainframe Knowledge Graph</p>
        <div className="login-tabs">
          <button className={`login-tab ${tab==='login'?'active':''}`} onClick={()=>setTab('login')}>Sign In</button>
          <button className={`login-tab ${tab==='register'?'active':''}`} onClick={()=>setTab('register')}>Register</button>
        </div>
        <form onSubmit={submit}>
          {tab==='register'&&<div className="fg"><label>Display Name</label>
            <input value={f.display_name} onChange={e=>setF({...f,display_name:e.target.value})} placeholder="Your name"/></div>}
          <div className="fg"><label>Username</label>
            <input value={f.username} onChange={e=>setF({...f,username:e.target.value})} placeholder="Username"/></div>
          <div className="fg"><label>Password</label>
            <input type="password" value={f.password} onChange={e=>setF({...f,password:e.target.value})} placeholder="Password"/></div>
          {tab==='register'&&<div className="utype-row">
            <button type="button" className={`utype-btn ${f.user_type==='associate'?'active':''}`}
              onClick={()=>setF({...f,user_type:'associate'})}>
              <span className="ico">◆</span>Associate<br/><small>Manage data</small></button>
            <button type="button" className={`utype-btn ${f.user_type==='new_joiner'?'active':''}`}
              onClick={()=>setF({...f,user_type:'new_joiner'})}>
              <span className="ico">◇</span>Viewer<br/><small>Explore graph</small></button>
          </div>}
          {err&&<p className="err-msg">{err}</p>}
          <button type="submit" className="btn btn-accent btn-full">{tab==='login'?'Sign In':'Create Account'}</button>
        </form>
      </div>
    </div>
  );
}

// ─── Main Graph App ───
function GraphApp({user,onLogout}){
  const svgRef=useRef(null);
  const[graphData,setGraphData]=useState({nodes:[],edges:[]});
  const[transform,setTransform]=useState({x:0,y:0,k:1});
  const[dragging,setDragging]=useState(null);
  const[panning,setPanning]=useState(null);
  const[selected,setSelected]=useState(null);
  const[hovered,setHovered]=useState(null);
  const[detailData,setDetailData]=useState(null);
  const[tooltip,setTooltip]=useState(null);
  const[searchQ,setSearchQ]=useState('');
  const[searchRes,setSearchRes]=useState([]);
  const[filters,setFilters]=useState({role:true,app:true,program:true,table:true});
  const[manageOpen,setManageOpen]=useState(false);
  const[apps,setApps]=useState([]);
  const[programs,setPrograms]=useState([]);
  const[tables,setTables]=useState([]);
  const[roles,setRoles]=useState([]);
  const[scrollEdges,setScrollEdges]=useState({t:false,b:false,l:false,r:false});
  const isAssociate=user.user_type==='associate';

  const NW=180,NH=70;

  // Compute scroll edge indicators based on graph bounds vs viewport
  const updateScrollEdges=useCallback((tf,nodes)=>{
    if(!nodes||nodes.length===0)return;
    const xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y);
    const pad=NW;
    const minX=Math.min(...xs)-pad,maxX=Math.max(...xs)+pad;
    const minY=Math.min(...ys)-pad,maxY=Math.max(...ys)+pad;
    const sw=window.innerWidth,sh=window.innerHeight;
    // World coords of viewport edges
    const vl=-tf.x/tf.k, vr=(sw-tf.x)/tf.k;
    const vt=-tf.y/tf.k, vb=(sh-tf.y)/tf.k;
    setScrollEdges({
      t:minY<vt-50, b:maxY>vb+50,
      l:minX<vl-50, r:maxX>vr+50
    });
  },[]);

  const reload=useCallback(async()=>{
    const[a,p,t,r,g]=await Promise.all([api('/applications'),api('/programs'),api('/tables'),api('/roles'),api('/graph')]);
    setApps(a);setPrograms(p);setTables(t);setRoles(r);
    const N=g.nodes.length;
    // Scale spacing based on node count so graph stays readable as data grows
    const spaceFactor=Math.max(1,Math.sqrt(N/20));
    const baseRad={role:220,app:520,program:800,table:1060};
    const nodes=g.nodes.map((n)=>{
      const typeNodes=g.nodes.filter(x=>x.type===n.type);
      const idx=typeNodes.indexOf(n);
      const ang=(idx/typeNodes.length)*2*Math.PI+(n.type==='role'?0:n.type==='app'?0.4:n.type==='program'?0.8:1.2);
      const rad=(baseRad[n.type]||600)*spaceFactor;
      const cx=1200*spaceFactor,cy=1000*spaceFactor;
      return{...n,x:cx+Math.cos(ang)*rad+(Math.random()-0.5)*80,
                   y:cy+Math.sin(ang)*rad+(Math.random()-0.5)*80,vx:0,vy:0};
    });
    const cx=1200*spaceFactor,cy=1000*spaceFactor;
    const repulsion=50000*spaceFactor;
    const idealLen=320*spaceFactor;
    for(let it=0;it<250;it++){
      const decay=1-it/300;
      for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
        const dx=nodes[j].x-nodes[i].x,dy=nodes[j].y-nodes[i].y;
        const d=Math.max(Math.sqrt(dx*dx+dy*dy),1);
        const f=repulsion/(d*d)*decay;
        nodes[i].vx-=(dx/d)*f;nodes[i].vy-=(dy/d)*f;
        nodes[j].vx+=(dx/d)*f;nodes[j].vy+=(dy/d)*f;
      }
      for(const e of g.edges){
        const s=nodes.find(n=>n.id===e.source),t2=nodes.find(n=>n.id===e.target);
        if(s&&t2){const dx=t2.x-s.x,dy=t2.y-s.y,d=Math.max(Math.sqrt(dx*dx+dy*dy),1);
          const f=(d-idealLen)*0.008*decay;
          s.vx+=(dx/d)*f;s.vy+=(dy/d)*f;t2.vx-=(dx/d)*f;t2.vy-=(dy/d)*f;}
      }
      for(const n of nodes){
        n.vx+=(cx-n.x)*0.0003;n.vy+=(cy-n.y)*0.0003;
        n.x+=n.vx*0.22;n.y+=n.vy*0.22;n.vx*=0.72;n.vy*=0.72;
      }
    }
    setGraphData({nodes,edges:g.edges});
  },[]);

  useEffect(()=>{reload()},[reload]);

  // Auto-fit on load
  useEffect(()=>{
    if(graphData.nodes.length>0&&transform.x===0&&transform.y===0&&transform.k===1){
      const xs=graphData.nodes.map(n=>n.x),ys=graphData.nodes.map(n=>n.y);
      const pad=NW*1.5;
      const minX=Math.min(...xs)-pad,maxX=Math.max(...xs)+pad;
      const minY=Math.min(...ys)-pad,maxY=Math.max(...ys)+pad;
      const gw=maxX-minX,gh=maxY-minY;
      const sw=window.innerWidth,sh=window.innerHeight;
      const scale=Math.min(sw/gw,sh/gh,1)*0.82;
      const cx2=(minX+maxX)/2,cy2=(minY+maxY)/2;
      const newT={x:sw/2-cx2*scale,y:sh/2-cy2*scale,k:scale};
      setTransform(newT);
      updateScrollEdges(newT,graphData.nodes);
    }
  },[graphData.nodes.length]);

  // Search
  useEffect(()=>{
    if(!searchQ.trim()){setSearchRes([]);return}
    const tm=setTimeout(async()=>{const r=await api(`/graph/search?q=${encodeURIComponent(searchQ)}`);setSearchRes(r)},200);
    return()=>clearTimeout(tm);
  },[searchQ]);

  const connSet=useMemo(()=>{
    const s=new Set();if(!selected)return s;s.add(selected);
    for(const e of graphData.edges){
      if(e.source===selected)s.add(e.target);
      if(e.target===selected)s.add(e.source);
    }return s;
  },[selected,graphData.edges]);

  const hoverSet=useMemo(()=>{
    const s=new Set();if(!hovered||selected)return s;s.add(hovered);
    for(const e of graphData.edges){
      if(e.source===hovered)s.add(e.target);
      if(e.target===hovered)s.add(e.source);
    }return s;
  },[hovered,selected,graphData.edges]);

  const openDetail=async(type,id)=>{
    const t2=type==='app'?'application':type==='prog'?'program':type;
    const data=await api(`/graph/explore/${t2}/${id}`);
    setDetailData(data);
  };

  const selectNode=n=>{
    setSelected(n.id);openDetail(n.type,n.entityId);
    setTransform(prev=>{
      const newT={...prev,x:window.innerWidth/2-n.x*prev.k-120,y:window.innerHeight/2-n.y*prev.k};
      updateScrollEdges(newT,graphData.nodes);
      return newT;
    });
  };

  const handleSearchSelect=item=>{
    setSearchQ('');setSearchRes([]);
    const prefix=item.type==='application'?'app':item.type==='program'?'prog':item.type;
    const node=graphData.nodes.find(n=>n.id===`${prefix}-${item.id}`);
    if(node)selectNode(node);
  };

  // Scroll = Pan in all directions, Ctrl+Scroll = Zoom
  const handleWheel=useCallback(e=>{
    e.preventDefault();
    if(e.ctrlKey||e.metaKey){
      const d=e.deltaY>0?0.92:1.08;
      const rect=svgRef.current.getBoundingClientRect();
      const mx=e.clientX-rect.left,my=e.clientY-rect.top;
      setTransform(t=>{
        const nk=Math.max(0.1,Math.min(4,t.k*d));
        const newT={x:mx-(mx-t.x)*(nk/t.k),y:my-(my-t.y)*(nk/t.k),k:nk};
        return newT;
      });
    }else{
      // Pan: deltaY = vertical, deltaX = horizontal. Shift+scroll = horizontal pan
      setTransform(t=>{
        const newT={...t,
          x:t.x - e.deltaX - (e.shiftKey?e.deltaY:0),
          y:t.y - (e.shiftKey?0:e.deltaY)
        };
        return newT;
      });
    }
  },[]);

  // Update scroll edge indicators whenever transform changes
  useEffect(()=>{
    updateScrollEdges(transform,graphData.nodes);
  },[transform,graphData.nodes,updateScrollEdges]);

  useEffect(()=>{
    const el=svgRef.current;if(!el)return;
    el.addEventListener('wheel',handleWheel,{passive:false});
    return()=>el.removeEventListener('wheel',handleWheel);
  },[handleWheel]);

  // Touch support for mobile panning
  const touchRef=useRef(null);
  const handleTouchStart=useCallback(e=>{
    if(e.touches.length===1){
      const t=e.touches[0];
      touchRef.current={sx:t.clientX,sy:t.clientY,tx:transform.x,ty:transform.y};
    }
  },[transform]);
  const handleTouchMove=useCallback(e=>{
    if(e.touches.length===1&&touchRef.current){
      e.preventDefault();
      const t=e.touches[0];
      setTransform(prev=>({...prev,
        x:touchRef.current.tx+t.clientX-touchRef.current.sx,
        y:touchRef.current.ty+t.clientY-touchRef.current.sy
      }));
    }
  },[]);
  const handleTouchEnd=useCallback(()=>{touchRef.current=null},[]);

  const handleMouseDown=e=>{if(!e.target.closest('.gnode'))setPanning({sx:e.clientX,sy:e.clientY,tx:transform.x,ty:transform.y})};
  const handleMouseMove=e=>{
    if(panning)setTransform(t=>({...t,x:panning.tx+e.clientX-panning.sx,y:panning.ty+e.clientY-panning.sy}));
    if(dragging){
      const svg=svgRef.current.getBoundingClientRect();
      setGraphData(prev=>({...prev,nodes:prev.nodes.map(n=>n.id===dragging?
        {...n,x:(e.clientX-svg.left-transform.x)/transform.k,y:(e.clientY-svg.top-transform.y)/transform.k}:n)}));
    }
  };
  const handleMouseUp=()=>{setPanning(null);setDragging(null)};
  const toggleFilter=type=>setFilters(f=>({...f,[type]:!f[type]}));

  const visibleNodes=graphData.nodes.filter(n=>filters[n.type]);
  const visibleIds=new Set(visibleNodes.map(n=>n.id));
  const visibleEdges=graphData.edges.filter(e=>visibleIds.has(e.source)&&visibleIds.has(e.target));
  const activeSet=selected?connSet:(hovered?hoverSet:null);

  const edgeLabelColor=(label)=>{
    if(label==='USES')return '#f59e0b';
    if(label==='BELONGS TO')return '#06b6d4';
    if(label==='READS')return '#10b981';
    if(label==='WRITES')return '#8b5cf6';
    return '#6366f1';
  };

  const fitAll=()=>{
    setSelected(null);setDetailData(null);
    if(!graphData.nodes.length)return;
    const xs=graphData.nodes.map(n=>n.x),ys=graphData.nodes.map(n=>n.y);
    const pad=NW*1.5;
    const minX=Math.min(...xs)-pad,maxX=Math.max(...xs)+pad;
    const minY=Math.min(...ys)-pad,maxY=Math.max(...ys)+pad;
    const gw=maxX-minX,gh=maxY-minY;
    const sw=window.innerWidth,sh=window.innerHeight;
    const scale=Math.min(sw/gw,sh/gh,1)*0.82;
    const cx2=(minX+maxX)/2,cy2=(minY+maxY)/2;
    setTransform({x:sw/2-cx2*scale,y:sh/2-cy2*scale,k:scale});
  };

  return(
    <div>
      <div className="canvas-bg"><div className="grid-pattern"></div></div>

      {/* Scroll edge indicators — show which directions have more content */}
      <div className={`scroll-hint-t ${scrollEdges.t?'vis':''}`}/>
      <div className={`scroll-hint-b ${scrollEdges.b?'vis':''}`}/>
      <div className={`scroll-hint-l ${scrollEdges.l?'vis':''}`}/>
      <div className={`scroll-hint-r ${scrollEdges.r?'vis':''}`}/>

      <div className="graph-full">
        <svg ref={svgRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
             onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
             onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          <defs>
            <marker id="ah" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0,8 3,0 6" fill="#3b4f7a" fillOpacity="0.6"/></marker>
            <marker id="ah-hl" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
              <polygon points="0 0,10 4,0 8" fill="#fbbf24"/></marker>
            <marker id="ah-hov" markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
              <polygon points="0 0,10 4,0 8" fill="#a5b4fc"/></marker>
            {Object.entries(COLORS).map(([k,c])=>(
              <React.Fragment key={k}>
                <linearGradient id={`grad-${k}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={c} stopOpacity="0.15"/>
                  <stop offset="100%" stopColor={c} stopOpacity="0.03"/>
                </linearGradient>
                <radialGradient id={`glow-${k}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={c} stopOpacity="0.3"/>
                  <stop offset="70%" stopColor={c} stopOpacity="0.05"/>
                  <stop offset="100%" stopColor={c} stopOpacity="0"/>
                </radialGradient>
                <filter id={`shadow-${k}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="3" stdDeviation="10" floodColor={c} floodOpacity="0.4"/>
                </filter>
                <filter id={`glow-filter-${k}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="0" stdDeviation="16" floodColor={c} floodOpacity="0.7"/>
                </filter>
              </React.Fragment>
            ))}
          </defs>
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>

            {/* ── Edges ── */}
            {visibleEdges.map((e,i)=>{
              const s=graphData.nodes.find(n=>n.id===e.source);
              const t2=graphData.nodes.find(n=>n.id===e.target);
              if(!s||!t2)return null;
              const isHl=activeSet&&activeSet.has(e.source)&&activeSet.has(e.target);
              const isDimmed=activeSet&&!isHl;
              const isSelected=selected&&connSet.has(e.source)&&connSet.has(e.target);
              const mx=(s.x+t2.x)/2,my=(s.y+t2.y)/2;
              const dx=t2.x-s.x,dy=t2.y-s.y;
              const len=Math.sqrt(dx*dx+dy*dy)||1;
              const curve=Math.min(len*0.1,50);
              const nx=-dy/len,ny=dx/len;
              const cx2=mx+nx*curve,cy2=my+ny*curve;
              const eColor=edgeLabelColor(e.label);
              const strokeColor=isSelected?'#fbbf24':isHl?eColor:eColor;
              const marker=isSelected?'url(#ah-hl)':isHl?'url(#ah-hov)':'url(#ah)';
              const isDashed=e.label==='READS'||e.label==='WRITES';
              return(
                <g key={i} className={`gedge ${isDimmed?'dimmed':''}`}
                  onMouseEnter={ev=>setTooltip({x:ev.clientX,y:ev.clientY,text:e.label,isEdge:true,color:eColor})}
                  onMouseLeave={()=>setTooltip(null)}>
                  <path d={`M${s.x},${s.y} Q${cx2},${cy2} ${t2.x},${t2.y}`} fill="none"
                    stroke="transparent" strokeWidth="14"/>
                  <path d={`M${s.x},${s.y} Q${cx2},${cy2} ${t2.x},${t2.y}`} fill="none"
                    stroke={strokeColor}
                    strokeWidth={isSelected?3:isHl?2:1}
                    opacity={isDimmed?0.04:isHl?0.85:0.2}
                    strokeDasharray={isDashed?'8,5':'none'}
                    markerEnd={marker}/>
                  {isHl&&<>
                    <rect x={cx2-32} y={cy2-18} width="64" height="18" rx="6"
                      fill={isSelected?'rgba(251,191,36,0.15)':'rgba(11,17,32,0.9)'}
                      stroke={isSelected?'#fbbf24':eColor} strokeWidth="0.8" strokeOpacity="0.5"/>
                    <text x={cx2} y={cy2-6} textAnchor="middle" fontSize="9"
                      fill={isSelected?'#fbbf24':eColor} fontFamily="Inter" fontWeight="700"
                      letterSpacing="0.5">{e.label}</text>
                  </>}
                </g>
              );
            })}

            {/* ── Nodes ── */}
            {visibleNodes.map(n=>{
              const isConn=!activeSet||activeSet.has(n.id);
              const isSel=selected===n.id;
              const isHov=hovered===n.id;
              const c=COLORS[n.type];
              const cl=COLORS_LIGHT[n.type];
              const hw=NW/2,hh=NH/2;
              return(
                <g key={n.id} className={`gnode ${!isConn?'dimmed':''} ${isSel?'selected':''}`}
                  style={{'--c':c}}
                  transform={`translate(${n.x},${n.y})`}
                  onClick={()=>selectNode(n)}
                  onMouseDown={e=>{e.stopPropagation();setDragging(n.id)}}
                  onMouseEnter={()=>setHovered(n.id)}
                  onMouseLeave={()=>setHovered(null)}>
                  <circle r={hw+35} fill={`url(#glow-${n.type})`} opacity={isSel?1:isHov?0.6:0.12}/>
                  <g className="node-shape" filter={isSel?`url(#glow-filter-${n.type})`:isHov?`url(#shadow-${n.type})`:undefined}>
                    <rect x={-hw} y={-hh} width={NW} height={NH} rx={14}
                      fill={`url(#grad-${n.type})`}/>
                    <rect x={-hw} y={-hh} width={NW} height={NH} rx={14}
                      fill={isSel?`${c}18`:'rgba(17,25,50,0.9)'}
                      stroke={c} strokeWidth={isSel?2.5:isHov?1.8:0.8}
                      strokeOpacity={isSel?0.9:isHov?0.6:0.18}/>
                    <rect x={-hw+14} y={-hh} width={NW-28} height="2" rx="1"
                      fill={c} opacity={isSel?0.8:isHov?0.4:0.12}/>
                  </g>
                  {/* Icon */}
                  <circle cx={-hw+30} cy={0} r={20}
                    fill={isSel?c:`${c}18`} stroke={c} strokeWidth={1.2}
                    strokeOpacity={isSel?0.8:0.25}/>
                  <g transform={`translate(${-hw+30},${0})`}>
                    <svg x="-10" y="-10" width="20" height="20" viewBox="0 0 24 24">
                      <path d={ICONS[n.type]} fill={isSel?'#0b1120':cl} opacity={isSel?1:0.9}/>
                    </svg>
                  </g>
                  {/* Name */}
                  <text x={-hw+58} y={-7} fontSize="13" fill={isSel?cl:'#eef2ff'} fontWeight="700"
                    fontFamily="Inter" textAnchor="start">
                    {n.label.length>13?n.label.slice(0,12)+'…':n.label}
                  </text>
                  {/* Type pill */}
                  <rect x={-hw+56} y={5} width={NW-68} height="16" rx="4"
                    fill={`${c}10`} stroke={c} strokeWidth="0.5" strokeOpacity="0.15"/>
                  <text x={-hw+58+(NW-68)/2} y={16} fontSize="8.5" fill={c} fontWeight="600"
                    fontFamily="Inter" textAnchor="middle" letterSpacing="0.5">
                    {TYPE_LABELS[n.type]}
                  </text>
                  {/* Connection count */}
                  {(()=>{
                    const cnt=graphData.edges.filter(e=>e.source===n.id||e.target===n.id).length;
                    return cnt>0?<>
                      <circle cx={hw-6} cy={-hh+6} r={8} fill={c} opacity="0.85"/>
                      <text x={hw-6} y={-hh+10} fontSize="8" fill="#0b1120" fontWeight="800"
                        fontFamily="Inter" textAnchor="middle">{cnt}</text>
                    </>:null;
                  })()}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* ══ TOP BAR — brand left, user right — no overlap ══ */}
      <div className="hud hud-bar">
        <div className="brand">
          <div className="brand-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div><span>KT Platform</span><small>Knowledge Graph</small></div>
        </div>
        <div className="hud-bar-right">
          {isAssociate&&<button className="btn btn-accent btn-sm" onClick={()=>setManageOpen(true)}
            style={{display:'flex',alignItems:'center',gap:5}}>
            <svg width="13" height="13" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor"/></svg>
            Manage
          </button>}
          <div className="user-pill" onClick={onLogout}>
            <svg width="14" height="14" viewBox="0 0 24 24"><path d={ICONS.role} fill="var(--accent-bright)"/></svg>
            {user.display_name} <span className="badge">{isAssociate?'Associate':'Viewer'}</span> ✕
          </div>
        </div>
      </div>

      {/* ══ ROW 2 — search + filters — centered, below top bar ══ */}
      <div className="hud hud-nav">
        <div className="hud-search">
          <span className="si">⌕</span>
          <input placeholder="Search roles, apps, programs, tables…" value={searchQ}
            onChange={e=>setSearchQ(e.target.value)}/>
          {searchRes.length>0&&<div className="hud-search-results">
            {searchRes.map((r,i)=><div key={i} className="sr-item" onClick={()=>handleSearchSelect(r)}>
              <svg width="14" height="14" viewBox="0 0 24 24" style={{flexShrink:0}}>
                <path d={ICONS[r.type==='application'?'app':r.type]||ICONS.app}
                  fill={COLORS[r.type==='application'?'app':r.type]||COLORS.app}/></svg>
              <span className={`tag ${TAG_CLS[r.type]||'tag-app'}`}>{r.type}</span>
              <span style={{fontWeight:500}}>{r.name}</span>
            </div>)}
          </div>}
        </div>
        <div className="hud-filters">
          {[['role','Roles'],['app','Apps'],['program','Programs'],['table','Tables']].map(([k,l])=>
            <button key={k} className={`fpill ${filters[k]?'active':'off'}`} onClick={()=>toggleFilter(k)}>
              <svg width="13" height="13" viewBox="0 0 24 24" style={{flexShrink:0}}>
                <path d={ICONS[k]} fill={COLORS[k]}/></svg>{l}
            </button>
          )}
        </div>
      </div>

      {/* ── Zoom controls ── */}
      <div className="hud hud-br">
        <button className="zoom-btn" onClick={()=>{
          const rect=svgRef.current.getBoundingClientRect();
          const mx=rect.width/2,my=rect.height/2;
          setTransform(t=>{const nk=Math.min(4,t.k*1.3);return{x:mx-(mx-t.x)*(nk/t.k),y:my-(my-t.y)*(nk/t.k),k:nk}});
        }}>+</button>
        <button className="zoom-btn" onClick={()=>{
          const rect=svgRef.current.getBoundingClientRect();
          const mx=rect.width/2,my=rect.height/2;
          setTransform(t=>{const nk=Math.max(0.1,t.k/1.3);return{x:mx-(mx-t.x)*(nk/t.k),y:my-(my-t.y)*(nk/t.k),k:nk}});
        }}>−</button>
        <button className="zoom-btn" title="Fit all" onClick={fitAll}>⟲</button>
      </div>

      {/* ── Legend ── */}
      <div className="hud hud-bl">
        <div className="legend-float">
          {[['role','Business Role'],['app','Application'],['program','Program'],['table','DB2 Table']].map(([k,l])=>
            <div key={k} className="li">
              <svg width="13" height="13" viewBox="0 0 24 24"><path d={ICONS[k]} fill={COLORS[k]}/></svg>
              <span>{l}</span>
            </div>
          )}
          <div style={{marginTop:6,paddingTop:6,borderTop:'1px solid var(--border)',fontSize:9.5,color:'var(--dim)',lineHeight:1.7}}>
            <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:1}}>
              <span style={{width:16,height:0,borderTop:'2px solid #f59e0b',opacity:0.5,flexShrink:0}}></span> USES
            </div>
            <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:1}}>
              <span style={{width:16,height:0,borderTop:'2px solid #06b6d4',opacity:0.5,flexShrink:0}}></span> BELONGS TO
            </div>
            <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:1}}>
              <span style={{width:16,height:0,borderTop:'2px dashed #10b981',opacity:0.5,flexShrink:0}}></span> READS
            </div>
            <div style={{display:'flex',alignItems:'center',gap:5}}>
              <span style={{width:16,height:0,borderTop:'2px dashed #8b5cf6',opacity:0.5,flexShrink:0}}></span> WRITES
            </div>
          </div>
          <div style={{marginTop:5,paddingTop:5,borderTop:'1px solid var(--border)',fontSize:9.5,color:'var(--dim)'}}>
            Scroll ↕↔ pan · Ctrl+Scroll zoom
          </div>
          {selected&&<div style={{marginTop:3}}>
            <span style={{fontSize:10,color:'var(--accent-bright)',cursor:'pointer',fontWeight:600}}
              onClick={()=>{setSelected(null);setDetailData(null)}}>✕ Clear focus</span>
          </div>}
        </div>
      </div>

      {/* ── Tooltip ── */}
      {tooltip&&<div className="tooltip" style={{left:tooltip.x+16,top:tooltip.y-14}}>
        {tooltip.isEdge?<div style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{width:14,height:2,background:tooltip.color,borderRadius:1}}></span>
          <span style={{fontWeight:700,color:tooltip.color}}>{tooltip.text}</span>
        </div>:<>
          <div className="tt-type" style={{color:COLORS[tooltip.type]}}>{TYPE_LABELS[tooltip.type]}</div>
          <div style={{fontWeight:700,fontSize:13}}>{tooltip.name}</div>
          {tooltip.desc&&<div className="tt-desc">{tooltip.desc.slice(0,120)+'…'}</div>}
        </>}
      </div>}

      {/* ── Detail Panel ── */}
      <DetailPanel data={detailData} onClose={()=>{setDetailData(null);setSelected(null)}} openDetail={(type,id)=>{
        openDetail(type,id);
        const prefix=type==='application'?'app':type==='program'?'prog':type;
        const node=graphData.nodes.find(n=>n.id===`${prefix}-${id}`);
        if(node)selectNode(node);
      }}/>

      {isAssociate&&<ManagePanel open={manageOpen} onClose={()=>setManageOpen(false)}
        apps={apps} programs={programs} tables={tables} roles={roles} reload={reload}/>}
    </div>
  );
}

// ─── Detail Panel ───
function DetailPanel({data,onClose,openDetail}){
  if(!data||!data.entity)return <div className="detail-overlay"></div>;
  const e=data.entity;
  const c=COLORS[e.type]||COLORS.app;
  const cl=COLORS_LIGHT[e.type]||COLORS_LIGHT.app;
  const icon=ICONS[e.type]||ICONS.app;
  return(
    <div className={`detail-overlay ${data?'open':''}`}>
      <button className="close" onClick={onClose}>✕</button>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
        <div style={{width:44,height:44,borderRadius:12,background:`${c}15`,border:`1.5px solid ${c}30`,
          display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <svg width="22" height="22" viewBox="0 0 24 24"><path d={icon} fill={c}/></svg>
        </div>
        <div>
          <h2 style={{color:cl,margin:0,fontSize:18}}>{e.name}</h2>
          <span className="dtype" style={{background:`${c}12`,color:c,margin:0,padding:'2px 8px',
            borderRadius:5,fontSize:10}}>{TYPE_LABELS[e.type]||e.type}</span>
        </div>
      </div>
      <div className="dsection"><h4>Description</h4><p>{e.description||'No description available.'}</p></div>
      {e.business_logic&&<div className="dsection"><h4>Business Logic</h4>
        <p style={{color:'var(--accent-bright)',fontStyle:'italic',background:'rgba(99,102,241,0.06)',
          padding:10,borderRadius:8,border:'1px solid var(--border)',fontSize:12}}>{e.business_logic}</p></div>}
      {e.application_name&&<div className="dsection"><h4>Application</h4>
        <p style={{display:'flex',alignItems:'center',gap:6}}>
          <svg width="14" height="14" viewBox="0 0 24 24"><path d={ICONS.app} fill={COLORS.app}/></svg>
          {e.application_name}</p></div>}
      {data.connected&&data.connected.length>0&&<div className="dsection">
        <h4>Connected ({data.connected.length})</h4>
        <ul className="dlist">
          {data.connected.map((cn,i)=>{
            const cc=COLORS[cn.type]||COLORS.app;
            const ci=ICONS[cn.type]||ICONS.app;
            return <li key={i} onClick={()=>openDetail(cn.type,cn.id)}>
              <svg width="14" height="14" viewBox="0 0 24 24" style={{flexShrink:0}}><path d={ci} fill={cc}/></svg>
              <span className="rel-badge" style={{background:`${cc}15`,color:cc,border:`1px solid ${cc}20`}}>{cn.relation}</span>
              <span style={{flex:1,fontWeight:500}}>{cn.name}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" style={{opacity:0.3}}>
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" fill="currentColor"/></svg>
            </li>;
          })}
        </ul>
      </div>}
    </div>
  );
}

// ─── Manage Panel ───
function ManagePanel({open,onClose,apps,programs,tables,roles,reload}){
  const[tab,setTab]=useState('applications');
  const[modal,setModal]=useState(null);
  const[form,setForm]=useState({});

  const openCreate=(type)=>{
    if(type==='applications')setForm({name:'',description:''});
    else if(type==='programs')setForm({name:'',description:'',business_logic:'',application_id:'',read_tables:[],write_tables:[]});
    else if(type==='tables')setForm({name:'',description:'',application_id:''});
    else setForm({name:'',description:'',application_ids:[],program_ids:[]});
    setModal({action:'create',type});
  };
  const openEdit=(type,item)=>{
    if(type==='applications')setForm({id:item.id,name:item.name,description:item.description});
    else if(type==='programs')setForm({id:item.id,name:item.name,description:item.description,business_logic:item.business_logic,
      application_id:item.application_id||'',read_tables:(item.read_tables||[]).map(t=>t.id),write_tables:(item.write_tables||[]).map(t=>t.id)});
    else if(type==='tables')setForm({id:item.id,name:item.name,description:item.description,application_id:item.application_id||''});
    else setForm({id:item.id,name:item.name,description:item.description,
      application_ids:(item.applications||[]).map(a=>a.id),program_ids:(item.programs||[]).map(p=>p.id)});
    setModal({action:'edit',type});
  };
  const save=async()=>{
    if(!form.name?.trim())return alert('Name is required');
    const endpoint=tab==='applications'?'/applications':tab==='programs'?'/programs':tab==='tables'?'/tables':'/roles';
    const body={...form};if(body.application_id==='')body.application_id=null;
    if(modal.action==='create')await api(endpoint,{method:'POST',body});
    else await api(`${endpoint}/${form.id}`,{method:'PUT',body});
    setModal(null);reload();
  };
  const remove=async(type,id)=>{
    if(!confirm('Delete this entity?'))return;
    const endpoint=type==='applications'?'/applications':type==='programs'?'/programs':type==='tables'?'/tables':'/roles';
    await api(`${endpoint}/${id}`,{method:'DELETE'});reload();
  };
  const toggleCheck=(field,id)=>{
    const arr=form[field]||[];
    setForm({...form,[field]:arr.includes(id)?arr.filter(x=>x!==id):[...arr,id]});
  };
  const entities=tab==='applications'?apps:tab==='programs'?programs:tab==='tables'?tables:roles;
  const typeKey=tab==='applications'?'app':tab==='programs'?'program':tab==='tables'?'table':'role';

  return(
    <div className={`manage-overlay ${open?'open':''}`} onClick={onClose}>
      <div className="manage-panel" onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <h2>Manage KT Data</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕ Close</button>
        </div>
        <div className="stats-row">
          {[['role',roles,'Roles'],['app',apps,'Apps'],['program',programs,'Programs'],['table',tables,'Tables']].map(([k,arr,l])=>
            <div key={k} className="mini-stat">
              <div className="val" style={{color:COLORS[k]}}>{arr.length}</div>
              <div className="lbl">{l}</div>
            </div>
          )}
        </div>
        <div className="manage-tabs">
          {['applications','programs','tables','roles'].map(t=>
            <button key={t} className={`manage-tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>
              <svg width="12" height="12" viewBox="0 0 24 24" style={{marginRight:4,verticalAlign:'middle'}}>
                <path d={ICONS[t==='applications'?'app':t==='programs'?'program':t==='tables'?'table':'role']}
                  fill={tab===t?'white':'currentColor'}/></svg>
              {t==='applications'?'Apps':t==='programs'?'Programs':t==='tables'?'DB2 Tables':'Roles'}
            </button>
          )}
        </div>
        <button className="btn btn-accent btn-sm" style={{marginBottom:14,display:'flex',alignItems:'center',gap:5}} onClick={()=>openCreate(tab)}>
          <svg width="13" height="13" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor"/></svg>
          Add {tab==='applications'?'Application':tab==='programs'?'Program':tab==='tables'?'DB2 Table':'Role'}
        </button>
        {entities.map(item=>(
          <div key={item.id} className="entity-card">
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:28,height:28,borderRadius:7,background:COLORS_BG[typeKey],
                display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width="14" height="14" viewBox="0 0 24 24"><path d={ICONS[typeKey]} fill={COLORS[typeKey]}/></svg>
              </div>
              <h4 style={{color:COLORS_LIGHT[typeKey],margin:0}}>{item.name}</h4>
            </div>
            <p style={{marginTop:4,marginLeft:36}}>{item.description?item.description.slice(0,90)+(item.description.length>90?'…':''):'No description'}</p>
            <div className="actions" style={{marginLeft:36}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(tab,item)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={()=>remove(tab,item.id)}>Delete</button>
            </div>
          </div>
        ))}
        {entities.length===0&&<p style={{color:'var(--dim)',fontSize:13,padding:20,textAlign:'center'}}>No {tab} yet.</p>}
        <UploadSection tab={tab} reload={reload}/>
      </div>
      {modal&&<div className="modal-bg" onClick={()=>setModal(null)}>
        <div className="modal-box" onClick={e=>e.stopPropagation()}>
          <h2>{modal.action==='create'?'Create':'Edit'} {modal.type==='applications'?'Application':modal.type==='programs'?'Program':modal.type==='tables'?'DB2 Table':'Business Role'}</h2>
          <div className="fg"><label>Name</label><input value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Entity name"/></div>
          <div className="fg"><label>Description</label><textarea value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Business description…"/></div>
          {modal.type==='programs'&&<>
            <div className="fg"><label>Business Logic</label><textarea value={form.business_logic||''} onChange={e=>setForm({...form,business_logic:e.target.value})} placeholder="Explain in plain language…"/></div>
            <div className="fg"><label>Application</label><select value={form.application_id||''} onChange={e=>setForm({...form,application_id:e.target.value})}><option value="">None</option>{apps.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            <div className="fg"><label>Reads from</label><div className="check-list">{tables.map(t=><label key={t.id} className="check-item"><input type="checkbox" checked={(form.read_tables||[]).includes(t.id)} onChange={()=>toggleCheck('read_tables',t.id)}/><span>{t.name}</span></label>)}{tables.length===0&&<span className="check-empty">No tables available</span>}</div></div>
            <div className="fg"><label>Writes to</label><div className="check-list">{tables.map(t=><label key={t.id} className="check-item"><input type="checkbox" checked={(form.write_tables||[]).includes(t.id)} onChange={()=>toggleCheck('write_tables',t.id)}/><span>{t.name}</span></label>)}{tables.length===0&&<span className="check-empty">No tables available</span>}</div></div>
          </>}
          {modal.type==='tables'&&<div className="fg"><label>Application</label><select value={form.application_id||''} onChange={e=>setForm({...form,application_id:e.target.value})}><option value="">None</option>{apps.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>}
          {modal.type==='roles'&&<>
            <div className="fg"><label>Uses Applications</label><div className="check-list">{apps.map(a=><label key={a.id} className="check-item"><input type="checkbox" checked={(form.application_ids||[]).includes(a.id)} onChange={()=>toggleCheck('application_ids',a.id)}/><span>{a.name}</span></label>)}{apps.length===0&&<span className="check-empty">No applications available</span>}</div></div>
            <div className="fg"><label>Uses Programs</label><div className="check-list">{programs.map(p=><label key={p.id} className="check-item"><input type="checkbox" checked={(form.program_ids||[]).includes(p.id)} onChange={()=>toggleCheck('program_ids',p.id)}/><span>{p.name}</span></label>)}{programs.length===0&&<span className="check-empty">No programs available</span>}</div></div>
          </>}
          <div className="modal-actions"><button className="btn btn-ghost" onClick={()=>setModal(null)}>Cancel</button><button className="btn btn-accent" onClick={save}>Save</button></div>
        </div>
      </div>}
    </div>
  );
}

function UploadSection({tab,reload}){
  const fileRef=useRef(null);
  const[result,setResult]=useState(null);
  const handleUpload=async()=>{
    const file=fileRef.current?.files[0];if(!file)return alert('Select a CSV file');
    const fd=new FormData();fd.append('file',file);fd.append('type',tab);
    const res=await fetch('/api/upload',{method:'POST',body:fd});
    const data=await res.json();setResult(data);reload();
  };
  return(
    <div style={{marginTop:20,paddingTop:16,borderTop:'1px solid var(--border)'}}>
      <h4 style={{fontSize:11,color:'var(--dim)',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.8px',fontWeight:700}}>Bulk CSV Upload</h4>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <input type="file" ref={fileRef} accept=".csv" style={{fontSize:12,color:'var(--muted)',flex:1}}/>
        <button className="btn btn-ghost btn-sm" onClick={handleUpload}>Upload</button>
      </div>
      {result&&<p style={{fontSize:12,marginTop:6,color:result.error?'var(--danger)':'var(--success)',
        padding:'5px 10px',borderRadius:6,background:result.error?'rgba(239,68,68,0.08)':'rgba(16,185,129,0.08)'}}>
        {result.error||`Imported ${result.imported} records`}</p>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
