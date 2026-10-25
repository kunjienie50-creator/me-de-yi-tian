// Reproduce from the supplied source: node scripts/generate-app-icons.cjs --prepare-trace
// Then run this script in Adobe Illustrator; only the new document is closed.
(function () {
  var old = app.userInteractionLevel;
  app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
  var doc = null;

  // Sample curves for containment without boolean operations that introduce seams.
  function polygon(path) {
    var points = path.pathPoints, result = [];
    for (var i = 0; i < points.length; i++) {
      var a = points[i], b = points[(i + 1) % points.length];
      for (var step = 0; step < 4; step++) {
        var t = step / 4, u = 1 - t;
        result.push([
          u*u*u*a.anchor[0] + 3*u*u*t*a.rightDirection[0] + 3*u*t*t*b.leftDirection[0] + t*t*t*b.anchor[0],
          u*u*u*a.anchor[1] + 3*u*u*t*a.rightDirection[1] + 3*u*t*t*b.leftDirection[1] + t*t*t*b.anchor[1]
        ]);
      }
    }
    return result;
  }

  function contains(x, y, outline) {
    var inside = false;
    for (var i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      var a = outline[i], b = outline[j];
      if (((a[1] > y) !== (b[1] > y)) &&
          x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }

  try {
    var root = new File($.fileName).parent.parent.fsName.replace(/\\/g, '/') + '/';
    var source = new File(root + '.dsh-check/tb-trace.png');
    if (!source.exists) throw new Error('请先运行 generate-app-icons.cjs --prepare-trace');
    doc = app.documents.add(DocumentColorSpace.RGB, 1536, 1536);
    doc.layers[0].name = 'me day · 原字样与花朵矢量';
    var placed = doc.placedItems.add();
    placed.file = source;
    placed.position = [0, 1536]; placed.width = 1536; placed.height = 1536;
    var traced = placed.trace();
    traced.tracing.tracingOptions.loadFromPreset('高保真度照片');
    app.redraw();
    var colors = traced.tracing.usedColorCount;
    var group = traced.tracing.expandTracing();
    group.name = 'me day · 原字样与花朵（无背景）';

    // The pink silhouette belongs to the supplied lettering. Keep that original
    // outline; do not add a mask, background, backplate or extra outline stroke.
    var silhouette = null, largest = 0;
    for (var i = 0; i < group.pathItems.length; i++) {
      var candidate = group.pathItems[i], color = candidate.fillColor;
      if (candidate.filled && color.typename === 'RGBColor' && color.red > 200 && color.red < 240 &&
          color.green > 120 && color.green < 170 && color.blue > 200 && color.blue < 240 &&
          Math.abs(candidate.area) > largest) {
        silhouette = candidate; largest = Math.abs(candidate.area);
      }
    }
    if (!silhouette || largest < 200000) throw new Error('未识别到原字样的粉色外轮廓');
    var bounds = silhouette.geometricBounds, outline = polygon(silhouette), removed = 0;
    for (var i = group.pathItems.length - 1; i >= 0; i--) {
      var path = group.pathItems[i];
      if (path === silhouette) continue;
      var box = path.geometricBounds;
      if (box[2] < bounds[0] || box[0] > bounds[2] || box[1] < bounds[3] || box[3] > bounds[1]) {
        path.remove(); removed++; continue;
      }
      var samples = polygon(path), within = 0;
      for (var j = 0; j < samples.length; j++) {
        if (contains(samples[j][0], samples[j][1], outline)) within++;
      }
      if (!samples.length || within / samples.length < 0.5) {
        path.remove(); removed++;
      }
    }
    doc.artboards[0].artboardRect = [bounds[0]-12, bounds[1]+12, bounds[2]+12, bounds[3]-12];
    app.redraw();
    if (doc.rasterItems.length || doc.placedItems.length) throw new Error('描摹结果仍含位图');
    var pathCount = doc.pathItems.length;
    var ai = new IllustratorSaveOptions(); ai.pdfCompatible = true; ai.compressed = true;
    // Save to an independent generated file first. Existing user documents stay open.
    var aiOutput = new File(root + '.dsh-check/icon-generated.ai');
    var svgOutput = new File(root + '.dsh-check/icon-generated.svg');
    doc.saveAs(aiOutput, ai);
    var svg = new ExportOptionsSVG(); svg.embedRasterImages = false; svg.coordinatePrecision = 3;
    svg.cssProperties = SVGCSSPropertyLocation.PRESENTATIONATTRIBUTES;
    doc.exportFile(svgOutput, ExportType.SVG, svg);
    doc.close(SaveOptions.DONOTSAVECHANGES); doc = null;
    if (!aiOutput.copy(root + 'design/app-icon/me-day-icon.ai') ||
        !svgOutput.copy(root + 'design/app-icon/me-day-icon.svg')) throw new Error('无法写入图标输出');
    var report = new File(root + '.dsh-check/icon-trace-report.json');
    report.open('w');
    report.write('{"colors":'+colors+',"paths":'+pathCount+',"removedBackgroundPaths":'+removed+',"rasterItems":0,"placedItems":0,"backgroundLayers":0,"clippingMasks":0,"addedOutlineStrokes":0}');
    report.close();
    return '无背景 AI 与 SVG 已导出；删除 '+removed+' 条底板与图外路径';
  } catch (e) {
    if (doc) { try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (_) {} }
    throw e;
  } finally { app.userInteractionLevel = old; }
})();