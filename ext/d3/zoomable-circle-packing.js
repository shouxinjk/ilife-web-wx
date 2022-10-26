////////////////////////////////////////////////////////////////////////////////
/////////////// The Zoomable Circle Packing/////////////////////////////////////
/////////////// https://observablehq.com/@d3/zoomable-circle-packing ///////////
////////////////////////////////////////////////////////////////////////////////
    
function ZoomableCirclePack(elementId, data, {
      path, // as an alternative to id and parentId, returns an array identifier, imputing internal nodes
      id = Array.isArray(data) ? d => d.id : null, // if tabular data, given a d in data, returns a unique identifier (string)
      parentId = Array.isArray(data) ? d => d.parentId : null, // if tabular data, given a node d, returns its parent’s identifier
      children, // if hierarchical data, given a d in data, returns its children
      value, // given a node d, returns a quantitative value (for area encoding; null for count)
      sort = (a, b) => d3.descending(a.value, b.value), // how to sort nodes prior to layout
      label, // given a node d, returns the name to display on the rectangle
      title, // given a node d, returns its hover text
      diameter = 200, //diameter
      margin = 20, //margin
    } = {}) {
    
  // If a path accessor is specified, we can impute the internal nodes from the slash-
  // separated path; otherwise, the tabular data must include the internal nodes, not
  // just leaves. TODO https://github.com/d3/d3-hierarchy/issues/33
  if (path != null) {
    const D = d3.map(data, d => d);
    const I = d3.map(data, path).map(d => (d = `${d}`).startsWith("/") ? d : `/${d}`);
    const paths = new Set(I);
    for (const path of paths) {
      const parts = path.split("/");
      while (parts.pop(), parts.length) {
        const path = parts.join("/") || "/";
        if (paths.has(path)) continue;
        paths.add(path), I.push(path), D.push(null);
      }
    }
    id = (_, i) => I[i];
    parentId = (_, i) => I[i] === "/" ? "" : I[i].slice(0, I[i].lastIndexOf("/")) || "/";
    data = D;
  }    
        
    /////////////////////////////////////////////////////////
    //////////// Create the container SVG and g /////////////
    /////////////////////////////////////////////////////////

    //Remove whatever chart with the same id/class was present before
    d3.select(elementId).select("svg").remove();
    
    //Initiate the radar chart SVG
    var svg = d3.select(elementId).append("svg")
            .attr("width",  diameter)
            .attr("height", diameter);
    //Append a g element        
    var g = svg.append("g").attr("transform", "translate(" + diameter / 2 + "," + diameter / 2 + ")");
    
    var color = d3.scaleLinear()
        .domain([-1, 5])
        .range(["hsl(152,80%,80%)", "hsl(228,30%,40%)"])
        .interpolate(d3.interpolateHcl);

    var pack = d3.pack()
        .size([diameter - margin, diameter - margin])
        .padding(2);

  // If id and parentId options are specified (perhaps implicitly via the path option),
  // use d3.stratify to convert tabular data to a hierarchy; otherwise we assume that
  // the data is specified as an object {children} with nested objects (a.k.a. the
  // “flare.json” format), and use d3.hierarchy.
  const root = id == null && parentId == null
      ? d3.hierarchy(data, children)
      : d3.stratify().id(id).parentId(parentId)(data);

      // Compute the values of internal nodes by aggregating from the leaves.
      value == null ? root.count() : root.sum(value);

      // Sort the leaves (typically by descending value for a pleasing layout).
      if (sort != null) root.sort(sort);

    var focus = root,
      nodes = pack(root).descendants(),
      view;

  var circle = g.selectAll("circle")
    .data(nodes)
    .enter().append("circle")
      .attr("class", function(d) { return d.parent ? d.children ? "node" : "node node--leaf" : "node node--root"; })
      .style("fill", function(d) { return d.children ? color(d.depth) : "white"; })
      .on("click", function(evt,d) { if (focus !== d) zoom(evt,d), evt.stopPropagation(); });

  var text = g.selectAll("text")
    .data(nodes)
    .enter().append("text")
      .attr("class", "label")
      .style("fill-opacity", function(d) { return d.parent === root ? 1 : 0; })
      .style("display", function(d) { return d.parent === root ? "inline" : "none"; })    
      .text(function(d) { return d.data.name; });

  var node = g.selectAll("circle,text");

  svg
      .style("background", color(-1))
      .on("click", function(evt) { zoom(evt,root); });

  zoomTo([root.x, root.y, root.r * 2 + margin]);

  function zoom(evt,d) {
    var focus0 = focus; focus = d;

    var transition = d3.transition()
        .duration(evt.altKey ? 7500 : 750)
        .tween("zoom", function(d) {
          var i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2 + margin]);
          return function(t) { zoomTo(i(t)); };
        });

    transition.selectAll("text")
      .filter(function(d) { return d.parent === focus || this.style.display === "inline"; })
        .style("fill-opacity", function(d) { return d.parent === focus ? 1 : 0; })
        .on("start", function(d) { if (d.parent === focus) this.style.display = "inline"; })
        .on("end", function(d) { if (d.parent !== focus) this.style.display = "none"; });
  }

  function zoomTo(v) {
    var k = diameter / v[2]; view = v;
    node.attr("transform", function(d) { return "translate(" + (d.x - v[0]) * k + "," + (d.y - v[1]) * k + ")"; });
    //text.attr("transform", function(d) { return "translate(" + (d.x - v[0]) * k + "," + (d.y - v[1]) * k + ")"; });
    circle.attr("r", function(d) { return d.r * k; });
  }

    return svg.node();
}//RadarChart