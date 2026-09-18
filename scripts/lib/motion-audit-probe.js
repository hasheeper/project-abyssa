/* Local artifact-server probe only. No RAF, timers, game writes, prototype
   patches or network. Read results from #abyssa-motion-audit JSON in the DOM. */
(() => {
  const output = document.createElement('script');
  output.id = 'abyssa-motion-audit'; output.type = 'application/json';
  document.head.append(output);
  const report = { version: 1, supported: typeof PerformanceObserver === 'undefined' ? [] : PerformanceObserver.supportedEntryTypes,
    initialHidden: document.hidden, entries: [], stages: [], actions: [], snapshots: [], truncated: false, stopped: false };
  const publish = () => { output.textContent = JSON.stringify(report); };
  const retain = (array, item) => { if (array.length < 300) array.push(item); else report.truncated = true; };
  const observers = [];
  const snapshot = () => {
    retain(report.snapshots, {at:performance.now(), route:location.hash.split('?')[0],
      animations:document.getAnimations().map(animation => ({
        name:animation.animationName ?? animation.transitionProperty ?? 'WAAPI', state:animation.playState,
        infinite:animation.effect?.getTiming().iterations === Infinity,
        target:animation.effect?.target instanceof Element ? animation.effect.target.getAttribute('class') : null,
      }))});
    publish();
  };
  for (const type of ['longtask', 'long-animation-frame']) {
    if (!report.supported.includes(type)) continue;
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) retain(report.entries, {
        type, startTime: entry.startTime, duration: entry.duration,
        blockingDuration: entry.blockingDuration ?? null,
        scripts: (entry.scripts ?? []).slice(0, 5).map(script => ({duration: script.duration,
          forcedStyleAndLayoutDuration: script.forcedStyleAndLayoutDuration, invoker: script.invoker})),
      });
      publish();
    });
    observer.observe({type, buffered:true}); observers.push(observer);
  }
  const attributes = ['data-character-intro', 'data-shop-intro', 'data-map-intro', 'data-ui-intro', 'data-menu-intro'];
  const stages = new MutationObserver(records => {
    for (const record of records) retain(report.stages, {at: performance.now(), route: location.hash.split('?')[0],
      attribute: record.attributeName, state: record.target.getAttribute(record.attributeName)});
    publish();
  });
  stages.observe(document, {subtree:true, attributes:true, attributeFilter:attributes});
  // Explicit snapshots avoid a sampler loop and distinguish stable idle from
  // transient entry. This small QA-only button lives outside the game root.
  const install = () => {
    const button = document.createElement('button'); button.type = 'button';
    button.textContent = '记录动效快照'; button.id = 'abyssa-motion-snapshot';
    button.style.cssText = 'position:fixed;right:4px;bottom:4px;z-index:2147483647;font:11px monospace';
    button.addEventListener('click', snapshot); document.body.append(button);
  };
  const action = event => {
    const target = event.target instanceof Element ? event.target.closest('button,a') : null;
    if (!target || target.id === 'abyssa-motion-snapshot') return;
    retain(report.actions, {at:performance.now(), label:target.getAttribute('aria-label') ?? target.textContent.trim().slice(0,60)});
    publish();
  };
  document.addEventListener('click', action, true);
  if (document.body) install(); else document.addEventListener('DOMContentLoaded', install, {once:true});
  window.addEventListener('pagehide', () => {
    observers.forEach(observer => observer.disconnect()); stages.disconnect();
    document.removeEventListener('click', action, true);
    document.removeEventListener('DOMContentLoaded', install);
    document.querySelector('#abyssa-motion-snapshot')?.remove();
    report.stopped = true; publish();
  }, {once:true});
  publish();
})();
