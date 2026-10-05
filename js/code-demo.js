// Types out a short code snippet inside the homepage hero's code-window mockup,
// then pauses and loops. Replaces the old Three.js 3D scene with a lightweight,
// dependency-free CSS/JS animation. Backs off to a static render for people
// with "reduce motion" turned on.
(function(){
  const codeEl = document.getElementById('codeTyper');
  if(!codeEl) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Each line is a list of tokens: { t: text, c: token class ('' / omitted = plain text) }
  const lines = [
    [{ t: 'function ', c: 'kw' }, { t: 'launch', c: 'fn' }, { t: '(project) {' }],
    [{ t: '  const plan = ' }, { t: 'scope', c: 'fn' }, { t: '(project);' }],
    [{ t: '  ' }, { t: 'build', c: 'fn' }, { t: '(plan);' }],
    [{ t: '  ' }, { t: '// ship it', c: 'cm' }],
    [{ t: '  return ' }, { t: '"shipped"', c: 'str' }, { t: ';' }],
    [{ t: '}' }]
  ];

  function renderStatic(){
    codeEl.innerHTML = '';
    lines.forEach((line, li) => {
      line.forEach(tok => {
        const span = document.createElement('span');
        if(tok.c) span.className = tok.c;
        span.textContent = tok.t;
        codeEl.appendChild(span);
      });
      if(li < lines.length - 1) codeEl.appendChild(document.createElement('br'));
    });
  }

  if(reduceMotion){
    renderStatic();
    return;
  }

  // Flatten every token's characters into one queue, with '\n' markers for line breaks.
  function buildQueue(){
    const queue = [];
    lines.forEach((line, li) => {
      line.forEach(tok => {
        for(const ch of tok.t) queue.push({ ch, cls: tok.c || null });
      });
      if(li < lines.length - 1) queue.push({ ch: '\n', cls: null });
    });
    return queue;
  }

  const cursor = document.createElement('span');
  cursor.className = 'type-cursor';

  let queue = buildQueue();
  let i = 0;
  let currentSpan = null;
  let currentCls;

  function typeStep(){
    if(i >= queue.length){
      cursor.remove();
      codeEl.appendChild(cursor);
      setTimeout(() => {
        codeEl.innerHTML = '';
        currentSpan = null;
        currentCls = undefined;
        i = 0;
        typeStep();
      }, 2200);
      return;
    }

    const { ch, cls } = queue[i];
    if(ch === '\n'){
      codeEl.appendChild(document.createElement('br'));
      currentSpan = null;
      currentCls = undefined;
    }else{
      if(!currentSpan || currentCls !== cls){
        currentSpan = document.createElement('span');
        if(cls) currentSpan.className = cls;
        codeEl.appendChild(currentSpan);
        currentCls = cls;
      }
      currentSpan.textContent += ch;
    }

    cursor.remove();
    codeEl.appendChild(cursor);

    i++;
    setTimeout(typeStep, 22 + Math.random() * 40);
  }

  typeStep();
})();
