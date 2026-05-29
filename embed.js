/* magazinnovostroek.su — catalog + popup, v5 */
(function(){
  var DATA_URL = (document.currentScript && document.currentScript.dataset.url) ||
                 (function(){var s=document.currentScript;if(s&&s.src){return s.src.replace(/[^/]*$/, 'data.json')}return 'data.json'})();
  var MOUNT_ID = 'mn-catalog';
  var EXISTING_BLOCK_SELECTOR = '#rec1186813941'; // старый блок "Предложения" — скрыть

  var ROOM_LABEL = {studio:'Студии','1':'1-комн','2':'2-комн','3':'3-комн','4':'4-комн'};
  var PLACEHOLDERS = {district:'Все районы', rooms:'Любая', year:'Любой год', 'class':'Любой', repair:'Не важно'};

  function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
  function uniq(arr){return Array.from(new Set(arr)).filter(function(v){return v!==null&&v!==undefined&&v!==''})}
  function shortAddr(a){return String(a||'').replace(/^Ростовская область,\s*/,'')}

  function injectStyle(){
    if(document.getElementById('mn-style-v5')) return;
    var s = document.createElement('style');
    s.id = 'mn-style-v5';
    s.textContent = STYLE_CSS;
    document.head.appendChild(s);
  }

  function ensureMount(){
    var el = document.getElementById(MOUNT_ID);
    if(el) return el;
    el = document.createElement('div');
    el.id = MOUNT_ID;
    var current = document.currentScript;
    if(current && current.parentElement){
      current.parentElement.appendChild(el);
    } else {
      document.body.appendChild(el);
    }
    return el;
  }

  function hideOldBlock(){
    var old = document.querySelector(EXISTING_BLOCK_SELECTOR);
    if(old) old.style.display = 'none';
  }

  /* ========== STATE ========== */
  var DATA = null;
  var CONTACTS = null;
  var FILTERS = null;
  var state = {district:[], rooms:[], year:[], 'class':[], repair:[]};

  function isActive(){return Object.keys(state).some(function(k){return state[k].length>0})}

  function computeFilters(){
    FILTERS = {
      district: uniq(DATA.map(function(i){return i.district})).sort(function(a,b){return a.localeCompare(b,'ru')}),
      rooms: ['studio','1','2','3','4'].filter(function(r){return DATA.some(function(i){return i.rooms.indexOf(r)>-1})}),
      year: uniq(DATA.map(function(i){return i.year})).sort(),
      'class': uniq(DATA.reduce(function(a,i){return a.concat(i.classes)},[])).sort(),
      repair: ['Только с ремонтом','Без ремонта']
    };
  }

  /* ========== RENDER CATALOG ========== */
  function renderShell(mount){
    mount.innerHTML = SHELL_HTML;
  }

  function renderDropdowns(){
    Object.keys(FILTERS).forEach(function(key){
      var wrap = document.querySelector('.mn-filter[data-filter="'+key+'"]');
      if(!wrap) return;
      var dd = wrap.querySelector('.mn-dropdown'); dd.innerHTML='';
      FILTERS[key].forEach(function(val){
        var lbl = document.createElement('label'); lbl.className='mn-opt';
        var cb = document.createElement('input'); cb.type='checkbox'; cb.value=String(val);
        cb.addEventListener('change', function(){
          var v = key==='year' ? Number(this.value) : this.value;
          var idx = state[key].indexOf(v);
          if(this.checked){if(idx===-1) state[key].push(v)} else {if(idx>-1) state[key].splice(idx,1)}
          updateSelectText(key); apply();
        });
        var span = document.createElement('span');
        span.textContent = key==='rooms' ? (ROOM_LABEL[val]||val) : (key==='year' ? String(val)+' год' : val);
        lbl.appendChild(cb); lbl.appendChild(span); dd.appendChild(lbl);
      });
    });
  }

  function updateSelectText(key){
    var wrap = document.querySelector('.mn-filter[data-filter="'+key+'"]');
    if(!wrap) return;
    var txt = wrap.querySelector('.mn-select-text'); var arr = state[key];
    if(arr.length===0){txt.textContent=PLACEHOLDERS[key]; txt.classList.add('mn-muted')}
    else if(arr.length===1){
      var v = arr[0];
      txt.textContent = key==='rooms' ? (ROOM_LABEL[v]||v) : (key==='year' ? String(v)+' год' : v);
      txt.classList.remove('mn-muted')
    } else {txt.textContent='Выбрано: '+arr.length; txt.classList.remove('mn-muted')}
  }

  function matches(item){
    if(state.district.length && state.district.indexOf(item.district)===-1) return false;
    if(state.rooms.length && !state.rooms.some(function(r){return item.rooms.indexOf(r)>-1})) return false;
    if(state.year.length && state.year.indexOf(item.year)===-1) return false;
    if(state['class'].length && !state['class'].some(function(c){return item.classes.indexOf(c)>-1})) return false;
    if(state.repair.length){
      if(state.repair.indexOf('Только с ремонтом')>-1 && !item.repair) return false;
      if(state.repair.indexOf('Без ремонта')>-1 && item.repair) return false;
    }
    return true;
  }

  function renderPromos(promos){
    if(!promos || promos.length===0) return '';
    var visible = promos.slice(0,1);
    var rest = promos.length - 1;
    var html = visible.map(function(p){return '<span class="mn-promo">'+esc(p)+'</span>'}).join('');
    if(rest>0) html += '<span class="mn-promo mn-promo-more">+'+rest+' '+(rest===1?'акция':(rest<5?'акции':'акций'))+'</span>';
    return html;
  }

  function renderRooms(rd){
    if(!rd || rd.length===0) return '';
    return rd.slice(0,4).map(function(r){
      return '<div class="mn-room">'+
        '<span class="mn-room-name">'+esc(r.name||'')+'</span>'+
        '<span class="mn-room-area">'+esc(r.area||'')+'</span>'+
        '<span class="mn-room-price">'+esc(r.price||'')+'</span>'+
      '</div>';
    }).join('');
  }

  function fmtSettlement(i){
    if(!i.settlement_raw) return '';
    return i.settlement_raw.replace(/\s*г\.$/,' г.');
  }

  function renderCard(i){
    var promos = renderPromos(i.promos);
    var sett = fmtSettlement(i);
    var settBlock = sett ? '<div class="mn-settlement">'+esc(sett) +
      (i.delivered?' <span class="mn-done">&#10003; Сдан</span>':'') + '</div>' : '';
    var rooms = renderRooms(i.rooms_detail);
    var mortgage = i.mortgage ? '<span class="mn-mortgage">В ипотеку от '+esc(i.mortgage)+'</span>' : '';
    var desc = i.desc ? '<p class="mn-desc">'+esc(i.desc)+'</p>' : '';
    var dev = i.developer ? '<div class="mn-developer">'+esc(i.developer)+'</div>' : '';
    var addr = shortAddr(i.address);
    var addrBlock = addr ? '<div class="mn-address">'+esc(addr)+'</div>' : '';

    return ''+
      '<article class="mn-card" data-id="'+esc(i.id)+'">'+
        '<div class="mn-img">'+
          '<img src="'+esc(i.preview)+'" alt="'+esc(i.name)+'" loading="lazy">'+
          (promos?'<div class="mn-promos">'+promos+'</div>':'')+
        '</div>'+
        '<div class="mn-body">'+
          settBlock+
          '<h3 class="mn-name">'+esc(i.name)+'</h3>'+
          addrBlock+
          (rooms?'<div class="mn-rooms">'+rooms+'</div>':'')+
          mortgage+
          desc+
          dev+
          '<button class="mn-more" data-id="'+esc(i.id)+'">Подробнее о жк</button>'+
        '</div>'+
      '</article>';
  }

  function apply(){
    var filtered = DATA.filter(matches);
    var cnt = document.getElementById('mn-count');
    if(cnt) cnt.textContent = filtered.length;
    var grid = document.getElementById('mn-grid');
    if(filtered.length===0){
      grid.innerHTML = '<div class="mn-empty"><b>Ничего не найдено</b>Попробуйте изменить параметры фильтра</div>';
    } else {
      grid.innerHTML = filtered.map(renderCard).join('');
    }
    var rs = document.getElementById('mn-reset');
    if(rs) rs.disabled = !isActive();
  }

  function bindSelects(){
    document.querySelectorAll('.mn-filter .mn-select').forEach(function(sel){
      sel.addEventListener('click', function(e){
        if(e.target.tagName==='INPUT' || e.target.tagName==='LABEL' || e.target.closest('.mn-opt')) return;
        var open = sel.classList.contains('mn-open');
        document.querySelectorAll('.mn-select.mn-open').forEach(function(s){s.classList.remove('mn-open')});
        if(!open) sel.classList.add('mn-open');
      });
    });
    document.addEventListener('click', function(e){
      if(!e.target.closest('.mn-filter')){
        document.querySelectorAll('.mn-select.mn-open').forEach(function(s){s.classList.remove('mn-open')});
      }
    });
  }

  function bindReset(){
    var rs = document.getElementById('mn-reset');
    if(!rs) return;
    rs.addEventListener('click', function(){
      Object.keys(state).forEach(function(k){state[k]=[]});
      document.querySelectorAll('.mn-dropdown input[type=checkbox]').forEach(function(cb){cb.checked=false});
      Object.keys(state).forEach(updateSelectText);
      apply();
    });
  }

  function bindCardClicks(){
    document.getElementById('mn-grid').addEventListener('click', function(e){
      var btn = e.target.closest('.mn-more');
      var card = e.target.closest('.mn-card');
      if(btn || (card && !e.target.closest('a'))){
        var id = (btn||card).getAttribute('data-id');
        openPopup(id);
      }
    });
  }

  /* ========== POPUP ========== */
  var popupCurrentItem = null;
  var galCur = 0;

  function waLink(i){
    var parts = ['Здравствуйте! Интересует ЖК ' + i.name];
    if(i.district) parts.push('район ' + i.district);
    if(i.settlement_raw){
      parts.push(i.settlement_raw.replace(/\.$/,'').toLowerCase());
    }
    var text = parts.join(', ') + '. Подскажите по наличию и цене.';
    return 'https://wa.me/' + CONTACTS.wa_phone + '?text=' + encodeURIComponent(text);
  }

  function openPopup(id){
    var item = DATA.filter(function(x){return x.id===String(id)})[0];
    if(!item) return;
    popupCurrentItem = item;
    galCur = 0;

    var p = item.popup || {};
    var gallery = (p.gallery && p.gallery.length) ? p.gallery : [item.preview];
    var plans = p.plans || [];
    var flats = p.flats || [];
    var chars = p.characteristics || {};
    var about = p.about || '';
    var addr = shortAddr(item.address);

    var overlay = document.getElementById('mn-overlay');
    if(!overlay){
      overlay = document.createElement('div');
      overlay.id = 'mn-overlay';
      overlay.className = 'mn-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = POPUP_HTML;
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    /* Gallery */
    var mainImg = overlay.querySelector('#mn-pop-main-img');
    var thumbs = overlay.querySelector('#mn-pop-thumbs');
    var nav = overlay.querySelector('#mn-pop-galnav');

    function showImg(i){
      if(!gallery.length) return;
      galCur = (i + gallery.length) % gallery.length;
      mainImg.src = gallery[galCur];
      nav.textContent = (galCur+1)+' / '+gallery.length;
      var ts = thumbs.querySelectorAll('img');
      for(var k=0;k<ts.length;k++) ts[k].classList.toggle('mn-active', k===galCur);
    }
    gallery.forEach(function(src, idx){
      var im = document.createElement('img');
      im.src = src; im.loading='lazy';
      im.addEventListener('click', function(){showImg(idx)});
      thumbs.appendChild(im);
    });
    overlay.querySelector('#mn-pop-prev').onclick = function(){showImg(galCur-1)};
    overlay.querySelector('#mn-pop-next').onclick = function(){showImg(galCur+1)};
    if(gallery.length) showImg(0);

    /* Promos overlay */
    var promosBox = overlay.querySelector('#mn-pop-promos');
    (item.promos||[]).slice(0,3).forEach(function(name, idx){
      var b = document.createElement('span');
      b.className = 'mn-pop-promo' + (idx>0?' mn-alt':'');
      b.textContent = String(name).trim();
      promosBox.appendChild(b);
    });

    /* Header */
    overlay.querySelector('#mn-pop-name').textContent = item.name;
    overlay.querySelector('#mn-pop-addr').textContent = addr;
    var prRange = p.price_from || (item.mortgage ? '' : '');
    var prEl = overlay.querySelector('#mn-pop-price-range');
    if(prRange){prEl.textContent = prRange} else {prEl.style.display='none'}
    var mortEl = overlay.querySelector('#mn-pop-mortgage');
    if(item.mortgage){mortEl.textContent = 'в ипотеку от '+item.mortgage} else {mortEl.style.display='none'}

    /* Flats (Квартиры в продаже) */
    var flatsBox = overlay.querySelector('#mn-pop-flats');
    if(flats.length){
      flats.forEach(function(fl){
        var row = document.createElement('div'); row.className='mn-pop-room';
        row.innerHTML = '<div class="mn-pop-room-left">'+
          '<span class="mn-pop-rooms">'+esc(fl.rooms||'')+'</span>'+
          '<span class="mn-pop-area">'+esc(fl.area||'')+'</span></div>'+
          '<span class="mn-pop-price">'+esc(fl.price||'')+'</span>';
        flatsBox.appendChild(row);
      });
    } else {
      flatsBox.previousElementSibling.style.display='none';
      flatsBox.style.display='none';
    }

    /* Plans (реальные планировки) */
    var plansBox = overlay.querySelector('#mn-pop-plans');
    var plansLabel = overlay.querySelector('#mn-pop-plans-label');
    if(plans.length){
      plans.forEach(function(pl){
        var card = document.createElement('div'); card.className='mn-pop-plan';
        card.innerHTML = '<img src="'+esc(pl.url)+'" alt="планировка '+esc(pl.rooms)+'" loading="lazy">'+
          '<div class="mn-pop-plan-meta">'+
            '<div class="mn-pop-plan-rooms">'+esc(pl.rooms)+'</div>'+
            '<div class="mn-pop-plan-area">'+esc(pl.area||'')+'</div>'+
          '</div>';
        plansBox.appendChild(card);
      });
    } else {
      plansLabel.style.display='none';
      plansBox.style.display='none';
    }

    /* Characteristics */
    var charsBox = overlay.querySelector('#mn-pop-chars');
    var rows = [
      ['Класс жилья', chars['class']],
      ['Сдача', chars.settlement],
      ['Домов в жк', chars.buildings],
      ['Этажность', chars.floors],
      ['Метражи', chars.areas],
      ['Высота потолков', chars.ceiling],
      ['Материал стен', chars.material],
      ['Парковка', chars.parking]
    ];
    var anyChars = false;
    rows.forEach(function(row){
      if(row[1]){
        anyChars = true;
        var d = document.createElement('div');
        d.innerHTML = '<b>'+esc(row[0])+'</b><span>'+esc(row[1])+'</span>';
        charsBox.appendChild(d);
      }
    });
    if(!anyChars){
      charsBox.previousElementSibling.style.display='none';
      charsBox.style.display='none';
    }

    /* About */
    var aboutBox = overlay.querySelector('#mn-pop-about');
    if(about){
      aboutBox.textContent = about;
      overlay.querySelector('#mn-pop-about-label').style.display='';
    } else {
      aboutBox.style.display='none';
      overlay.querySelector('#mn-pop-about-label').style.display='none';
    }

    /* Developer */
    var devBox = overlay.querySelector('#mn-pop-developer');
    if(item.developer){devBox.textContent = item.developer} else {devBox.style.display='none'}

    /* Buttons */
    overlay.querySelector('#mn-pop-tel').href = 'tel:+'+CONTACTS.wa_phone;
    overlay.querySelector('#mn-pop-tel').textContent = CONTACTS.tel_display;
    overlay.querySelector('#mn-pop-wa').href = waLink(item);
    overlay.querySelector('#mn-pop-tg').href = CONTACTS.tg_link;
    overlay.querySelector('#mn-pop-max').href = CONTACTS.max_link;

    /* Close */
    function close(){
      overlay.style.display='none';
      document.body.style.overflow='';
    }
    overlay.querySelector('#mn-pop-close').onclick = close;
    overlay.addEventListener('click', function(e){
      if(e.target === overlay) close();
    });
    document.addEventListener('keydown', function escClose(e){
      if(e.key==='Escape'){close(); document.removeEventListener('keydown', escClose)}
    });
  }

  /* ========== INIT ========== */
  function init(){
    injectStyle();
    hideOldBlock();
    var mount = ensureMount();
    renderShell(mount);

    fetch(DATA_URL + '?v=' + Date.now(), {cache:'no-store'})
      .then(function(r){return r.json()})
      .then(function(payload){
        DATA = payload.items;
        CONTACTS = payload.contacts;
        computeFilters();
        renderDropdowns();
        bindSelects();
        bindReset();
        bindCardClicks();
        apply();
      })
      .catch(function(err){
        mount.innerHTML = '<div style="padding:40px;text-align:center;color:#d33"><b>Ошибка загрузки каталога</b><br>'+esc(err.message||err)+'</div>';
      });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();

/* ========== TEMPLATES ========== */
var SHELL_HTML = (
  '<div class="mn-wrap">'+
    '<div class="mn-filters" id="mn-filters">'+
      '<div class="mn-filter" data-filter="district"><div class="mn-filter-label">Район</div><div class="mn-select"><span class="mn-select-text mn-muted">Все районы</span><span class="mn-select-arrow">&#9662;</span><div class="mn-dropdown"></div></div></div>'+
      '<div class="mn-filter" data-filter="rooms"><div class="mn-filter-label">Комнатность</div><div class="mn-select"><span class="mn-select-text mn-muted">Любая</span><span class="mn-select-arrow">&#9662;</span><div class="mn-dropdown"></div></div></div>'+
      '<div class="mn-filter" data-filter="year"><div class="mn-filter-label">Срок сдачи</div><div class="mn-select"><span class="mn-select-text mn-muted">Любой год</span><span class="mn-select-arrow">&#9662;</span><div class="mn-dropdown"></div></div></div>'+
      '<div class="mn-filter" data-filter="class"><div class="mn-filter-label">Класс жилья</div><div class="mn-select"><span class="mn-select-text mn-muted">Любой</span><span class="mn-select-arrow">&#9662;</span><div class="mn-dropdown"></div></div></div>'+
      '<div class="mn-filter" data-filter="repair"><div class="mn-filter-label">Ремонт</div><div class="mn-select"><span class="mn-select-text mn-muted">Не важно</span><span class="mn-select-arrow">&#9662;</span><div class="mn-dropdown"></div></div></div>'+
    '</div>'+
    '<div class="mn-toolbar">'+
      '<div class="mn-count">Найдено: <b id="mn-count">0</b></div>'+
      '<button class="mn-reset" id="mn-reset" disabled>Сбросить фильтры</button>'+
    '</div>'+
    '<div class="mn-grid" id="mn-grid"></div>'+
  '</div>'
);

var POPUP_HTML = (
  '<div class="mn-pop" role="dialog" aria-modal="true">'+
    '<button class="mn-pop-close" id="mn-pop-close" aria-label="Закрыть">&times;</button>'+
    '<div class="mn-pop-gallery">'+
      '<div class="mn-pop-main">'+
        '<img id="mn-pop-main-img" alt="">'+
        '<div class="mn-pop-arrows"><button id="mn-pop-prev">&lsaquo;</button><button id="mn-pop-next">&rsaquo;</button></div>'+
        '<div class="mn-pop-galnav" id="mn-pop-galnav">1 / 1</div>'+
        '<div class="mn-pop-promos" id="mn-pop-promos"></div>'+
      '</div>'+
      '<div class="mn-pop-thumbs" id="mn-pop-thumbs"></div>'+
    '</div>'+
    '<div class="mn-pop-info">'+
      '<div class="mn-pop-tag">Жилой комплекс</div>'+
      '<h2 class="mn-pop-name" id="mn-pop-name"></h2>'+
      '<div class="mn-pop-addr" id="mn-pop-addr"></div>'+
      '<div class="mn-pop-price-row"><span class="mn-pop-price-range" id="mn-pop-price-range"></span><span class="mn-pop-mortgage" id="mn-pop-mortgage"></span></div>'+
      '<div class="mn-pop-label">Квартиры в продаже</div>'+
      '<div class="mn-pop-flats" id="mn-pop-flats"></div>'+
      '<div class="mn-pop-label" id="mn-pop-plans-label">Планировки</div>'+
      '<div class="mn-pop-plans" id="mn-pop-plans"></div>'+
      '<div class="mn-pop-label">Характеристики жк</div>'+
      '<div class="mn-pop-chars" id="mn-pop-chars"></div>'+
      '<div class="mn-pop-label" id="mn-pop-about-label">О жк</div>'+
      '<div class="mn-pop-about" id="mn-pop-about"></div>'+
      '<div class="mn-pop-developer" id="mn-pop-developer"></div>'+
      '<div class="mn-pop-actions">'+
        '<a class="mn-pop-btn mn-pop-btn-tel" id="mn-pop-tel" href="#"></a>'+
        '<a class="mn-pop-btn mn-pop-btn-wa" id="mn-pop-wa" href="#" target="_blank" rel="noopener">WhatsApp</a>'+
        '<a class="mn-pop-btn mn-pop-btn-tg" id="mn-pop-tg" href="#" target="_blank" rel="noopener">Telegram</a>'+
        '<a class="mn-pop-btn mn-pop-btn-max" id="mn-pop-max" href="#" target="_blank" rel="noopener">MAX</a>'+
      '</div>'+
    '</div>'+
  '</div>'
);

var STYLE_CSS = (
'#mn-catalog .mn-wrap,#mn-overlay,#mn-overlay *{box-sizing:border-box}'+
'#mn-catalog .mn-wrap{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:1200px;margin:0 auto;padding:24px 16px;color:#1a1a1a}'+
'#mn-catalog .mn-filters{background:#f7f7f9;border-radius:14px;padding:16px;margin-bottom:20px;display:grid;grid-template-columns:repeat(5,1fr);gap:12px}'+
'#mn-catalog .mn-filter{display:flex;flex-direction:column;gap:6px;min-width:0;position:relative}'+
'#mn-catalog .mn-filter-label{font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.04em}'+
'#mn-catalog .mn-select{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;font-size:14px;cursor:pointer;width:100%;min-height:42px;display:flex;align-items:center;justify-content:space-between;gap:8px;position:relative}'+
'#mn-catalog .mn-select-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}'+
'#mn-catalog .mn-select-text.mn-muted{color:#9ca3af}'+
'#mn-catalog .mn-select-arrow{flex-shrink:0;color:#6b7280;font-size:10px;transition:transform .15s}'+
'#mn-catalog .mn-select.mn-open .mn-select-arrow{transform:rotate(180deg)}'+
'#mn-catalog .mn-dropdown{position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.08);max-height:280px;overflow-y:auto;z-index:50;padding:6px;display:none}'+
'#mn-catalog .mn-select.mn-open + .mn-dropdown,#mn-catalog .mn-select.mn-open .mn-dropdown{display:block}'+
'#mn-catalog .mn-opt{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;font-size:14px;cursor:pointer;user-select:none}'+
'#mn-catalog .mn-opt:hover{background:#f3f4f6}'+
'#mn-catalog .mn-opt input{margin:0;cursor:pointer;width:16px;height:16px}'+
'#mn-catalog .mn-toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px}'+
'#mn-catalog .mn-count{font-size:14px;color:#6b7280}'+
'#mn-catalog .mn-count b{color:#1a1a1a;font-weight:600}'+
'#mn-catalog .mn-reset{background:none;border:none;color:#0066ff;font-size:14px;cursor:pointer;padding:6px 10px;border-radius:8px;font-weight:500}'+
'#mn-catalog .mn-reset:hover{background:#eef4ff}'+
'#mn-catalog .mn-reset[disabled]{color:#cbd5e1;cursor:default;background:none}'+
'#mn-catalog .mn-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}'+
'#mn-catalog .mn-card{background:#fff;border:1px solid #ececec;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;transition:transform .15s,box-shadow .15s;cursor:pointer}'+
'#mn-catalog .mn-card:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(0,0,0,.08);border-color:#dcdcdc}'+
'#mn-catalog .mn-img{position:relative;width:100%;aspect-ratio:16/10;background:#f3f4f6;overflow:hidden}'+
'#mn-catalog .mn-img img{width:100%;height:100%;object-fit:cover;display:block}'+
'#mn-catalog .mn-promos{position:absolute;left:12px;bottom:12px;display:flex;gap:6px;flex-wrap:wrap;max-width:calc(100% - 24px)}'+
'#mn-catalog .mn-promo{font-size:11.5px;font-weight:600;color:#fff;background:#0066ff;padding:5px 9px;border-radius:6px;white-space:nowrap}'+
'#mn-catalog .mn-promo.mn-promo-more{background:rgba(255,255,255,.95);color:#1a1a1a}'+
'#mn-catalog .mn-body{padding:16px;display:flex;flex-direction:column;gap:10px;flex:1}'+
'#mn-catalog .mn-settlement{font-size:13px;color:#6b7280;display:flex;flex-wrap:wrap;gap:8px;align-items:center}'+
'#mn-catalog .mn-done{color:#10b981;font-weight:500}'+
'#mn-catalog .mn-name{font-size:19px;font-weight:700;line-height:1.2;margin:0}'+
'#mn-catalog .mn-address{font-size:13px;color:#6b7280;line-height:1.4}'+
'#mn-catalog .mn-rooms{display:flex;flex-direction:column;gap:6px;font-size:13.5px;border-top:1px solid #f1f1f1;padding-top:10px}'+
'#mn-catalog .mn-room{display:grid;grid-template-columns:70px 1fr auto;gap:8px;align-items:baseline}'+
'#mn-catalog .mn-room-name{color:#6b7280;font-weight:500}'+
'#mn-catalog .mn-room-area{color:#9ca3af;font-size:12.5px}'+
'#mn-catalog .mn-room-price{color:#1a1a1a;font-weight:600;text-align:right}'+
'#mn-catalog .mn-mortgage{font-size:13.5px;color:#0066ff;font-weight:500;padding-top:6px;border-top:1px solid #f1f1f1}'+
'#mn-catalog .mn-desc{font-size:12.5px;color:#374151;line-height:1.45;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}'+
'#mn-catalog .mn-developer{font-size:11.5px;color:#9ca3af;font-weight:500;text-transform:uppercase;letter-spacing:.04em}'+
'#mn-catalog .mn-more{margin-top:auto;background:#1a1a1a;color:#fff;border:none;padding:11px 12px;border-radius:8px;font-size:13.5px;font-weight:600;cursor:pointer;text-transform:lowercase}'+
'#mn-catalog .mn-more:hover{background:#3b3b3b}'+
'#mn-catalog .mn-empty{grid-column:1/-1;text-align:center;padding:60px 20px;color:#6b7280;font-size:15px}'+
'#mn-catalog .mn-empty b{color:#1a1a1a;display:block;font-size:18px;margin-bottom:6px}'+
'@media (max-width:900px){#mn-catalog .mn-filters{grid-template-columns:repeat(2,1fr)}#mn-catalog .mn-grid{grid-template-columns:repeat(2,1fr);gap:14px}#mn-catalog .mn-name{font-size:17px}}'+
'@media (max-width:560px){#mn-catalog .mn-filters{grid-template-columns:1fr;padding:12px}#mn-catalog .mn-grid{grid-template-columns:1fr;gap:12px}#mn-catalog .mn-card{border-radius:12px}#mn-catalog .mn-body{padding:14px;gap:9px}#mn-catalog .mn-name{font-size:16px}}'+
/* ========== POPUP CSS ========== */
'#mn-overlay{position:fixed;inset:0;background:rgba(15,20,30,.6);backdrop-filter:blur(4px);z-index:9999;display:none;align-items:flex-start;justify-content:center;padding:24px;overflow-y:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1a1a1a}'+
'#mn-overlay .mn-pop{background:#fff;border-radius:18px;max-width:1100px;width:100%;box-shadow:0 30px 80px rgba(0,0,0,.35);overflow:hidden;position:relative;display:grid;grid-template-columns:1.2fr 1fr;min-height:600px}'+
'#mn-overlay .mn-pop-close{position:absolute;top:14px;right:14px;width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.95);border:none;font-size:26px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:20;box-shadow:0 2px 8px rgba(0,0,0,.15);line-height:1;font-weight:300}'+
'#mn-overlay .mn-pop-gallery{background:#0f1420;display:flex;flex-direction:column;color:#fff;min-height:600px;position:relative}'+
'#mn-overlay .mn-pop-main{flex:1;position:relative;min-height:380px;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden}'+
'#mn-overlay .mn-pop-main img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}'+
'#mn-overlay .mn-pop-galnav{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.6);padding:6px 14px;border-radius:20px;font-size:12px;color:#fff;font-weight:500;z-index:5}'+
'#mn-overlay .mn-pop-arrows{position:absolute;top:50%;left:0;right:0;display:flex;justify-content:space-between;padding:0 12px;transform:translateY(-50%);pointer-events:none;z-index:5}'+
'#mn-overlay .mn-pop-arrows button{width:42px;height:42px;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;border:none;font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;pointer-events:auto;line-height:1}'+
'#mn-overlay .mn-pop-thumbs{display:flex;gap:6px;padding:10px;overflow-x:auto;background:#0a0e16}'+
'#mn-overlay .mn-pop-thumbs img{width:90px;height:64px;object-fit:cover;border-radius:6px;cursor:pointer;opacity:.65;flex-shrink:0;outline:2px solid transparent}'+
'#mn-overlay .mn-pop-thumbs img.mn-active{opacity:1;outline:2px solid #0066ff}'+
'#mn-overlay .mn-pop-promos{position:absolute;left:14px;bottom:50px;display:flex;gap:6px;flex-wrap:wrap;max-width:calc(100% - 28px);z-index:4}'+
'#mn-overlay .mn-pop-promo{background:#0066ff;color:#fff;font-size:12px;font-weight:600;padding:6px 11px;border-radius:6px;white-space:nowrap}'+
'#mn-overlay .mn-pop-promo.mn-alt{background:rgba(255,255,255,.95);color:#1a1a1a}'+
'#mn-overlay .mn-pop-info{padding:28px 26px 22px;display:flex;flex-direction:column;gap:12px;overflow-y:auto;max-height:90vh;background:#fff}'+
'#mn-overlay .mn-pop-tag{font-size:11px;font-weight:700;color:#0066ff;text-transform:uppercase;letter-spacing:.1em}'+
'#mn-overlay .mn-pop-name{font-size:26px;font-weight:800;line-height:1.15;margin:0;color:#1a1a1a}'+
'#mn-overlay .mn-pop-addr{font-size:14px;color:#6b7280;line-height:1.4}'+
'#mn-overlay .mn-pop-price-row{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px}'+
'#mn-overlay .mn-pop-price-range{font-size:20px;font-weight:700;color:#1a1a1a}'+
'#mn-overlay .mn-pop-mortgage{font-size:13px;color:#0066ff;font-weight:500}'+
'#mn-overlay .mn-pop-label{font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;margin-top:6px}'+
'#mn-overlay .mn-pop-flats{display:flex;flex-direction:column;gap:8px;padding-top:6px;border-top:1px solid #f1f1f1}'+
'#mn-overlay .mn-pop-room{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap}'+
'#mn-overlay .mn-pop-room-left{display:flex;gap:10px;align-items:baseline;min-width:0;flex:1}'+
'#mn-overlay .mn-pop-rooms{color:#6b7280;font-weight:500;font-size:13.5px}'+
'#mn-overlay .mn-pop-area{color:#9ca3af;font-size:12.5px}'+
'#mn-overlay .mn-pop-price{font-weight:700;color:#1a1a1a;font-size:13.5px;white-space:nowrap}'+
'#mn-overlay .mn-pop-plans{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding-top:6px;border-top:1px solid #f1f1f1}'+
'#mn-overlay .mn-pop-plan{background:#f7f7f9;border-radius:10px;overflow:hidden;display:flex;flex-direction:column}'+
'#mn-overlay .mn-pop-plan img{width:100%;height:140px;object-fit:contain;background:#fff;display:block}'+
'#mn-overlay .mn-pop-plan-meta{padding:8px 10px;font-size:12px;display:flex;justify-content:space-between;align-items:baseline}'+
'#mn-overlay .mn-pop-plan-rooms{font-weight:600;color:#1a1a1a}'+
'#mn-overlay .mn-pop-plan-area{color:#9ca3af}'+
'#mn-overlay .mn-pop-chars{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:13px;padding-top:6px;border-top:1px solid #f1f1f1}'+
'#mn-overlay .mn-pop-chars > div b{color:#6b7280;font-weight:500;display:block;font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}'+
'#mn-overlay .mn-pop-chars > div span{color:#1a1a1a;font-weight:600;font-size:13.5px}'+
'#mn-overlay .mn-pop-about{font-size:13.5px;color:#374151;line-height:1.55;padding-top:6px;border-top:1px solid #f1f1f1}'+
'#mn-overlay .mn-pop-developer{font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;font-weight:600}'+
'#mn-overlay .mn-pop-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:auto;padding-top:14px}'+
'#mn-overlay .mn-pop-btn{padding:13px 6px;border-radius:10px;text-decoration:none;font-size:12.5px;font-weight:600;text-align:center;display:flex;align-items:center;justify-content:center;line-height:1.2}'+
'#mn-overlay .mn-pop-btn-tel{background:#fff;color:#1a1a1a !important;border:1.5px solid #1a1a1a}'+
'#mn-overlay .mn-pop-btn-wa{background:#25d366;color:#fff !important;border:1.5px solid #25d366}'+
'#mn-overlay .mn-pop-btn-tg{background:#2aabee;color:#fff !important;border:1.5px solid #2aabee}'+
'#mn-overlay .mn-pop-btn-max{background:#ff6a00;color:#fff !important;border:1.5px solid #ff6a00}'+
'@media (max-width:900px){#mn-overlay{padding:12px 6px}#mn-overlay .mn-pop{grid-template-columns:1fr;min-height:auto;border-radius:14px}#mn-overlay .mn-pop-gallery{min-height:auto}#mn-overlay .mn-pop-main{min-height:240px}#mn-overlay .mn-pop-info{padding:22px 18px 18px;gap:11px;max-height:none;overflow:visible}#mn-overlay .mn-pop-name{font-size:22px}#mn-overlay .mn-pop-price-range{font-size:18px}#mn-overlay .mn-pop-chars{grid-template-columns:1fr}#mn-overlay .mn-pop-actions{grid-template-columns:repeat(2,1fr);gap:8px}#mn-overlay .mn-pop-btn{padding:13px 4px;font-size:13px}}'+
'@media (max-width:480px){#mn-overlay .mn-pop-name{font-size:20px}#mn-overlay .mn-pop-main{min-height:200px}#mn-overlay .mn-pop-thumbs img{width:72px;height:52px}#mn-overlay .mn-pop-promos{bottom:48px}#mn-overlay .mn-pop-plans{grid-template-columns:1fr}#mn-overlay .mn-pop-plan img{height:180px}}'
);
})();
