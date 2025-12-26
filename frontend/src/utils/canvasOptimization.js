export const optimizeCanvasPerformance = (canvas) => {
  if (!canvas) return;
  
  // Deshabilitar características que consumen recursos
  canvas.skipTargetFind = false;
  canvas.stopContextMenu = true;
  canvas.allowTouchScrolling = false;
  
  // Optimizar renderizado
  canvas.renderOnAddRemove = false;
  canvas.skipOffscreen = true;
  
  // Limitar frecuencia de renderizado
  let renderTimeout;
  canvas.debouncedRenderAll = () => {
    if (renderTimeout) {
      clearTimeout(renderTimeout);
    }
    renderTimeout = setTimeout(() => {
      canvas.renderAll();
    }, 16); // ~60fps
  };
  
  // Reemplazar renderAll por debouncedRenderAll en eventos
  const originalAdd = canvas.add;
  canvas.add = function(...args) {
    const result = originalAdd.apply(this, args);
    this.debouncedRenderAll();
    return result;
  };
  
  const originalRemove = canvas.remove;
  canvas.remove = function(...args) {
    const result = originalRemove.apply(this, args);
    this.debouncedRenderAll();
    return result;
  };
  
  return canvas;
};

export const disableCanvasEvents = (canvas) => {
  if (!canvas) return;
  
  // Deshabilitar eventos innecesarios
  canvas.off('mouse:down');
  canvas.off('mouse:move');
  canvas.off('mouse:up');
  canvas.off('object:moving');
  canvas.off('object:scaling');
  canvas.off('object:rotating');
  
  // Mantener solo eventos esenciales
  canvas.on('object:modified', () => {
    canvas.debouncedRenderAll();
  });
};