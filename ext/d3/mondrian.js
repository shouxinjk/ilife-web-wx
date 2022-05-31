/////////////////////////////////////////////////////////
//Generate Mondrian Art Diagram
//Based on Treemap
//Inspired by Swizec Teller
//https://reactfordataviz.com/articles/mondrian-art-generator
/////////////////////////////////////////////////////////
    
function Mondrian(id, data, options) {
    var cfg = {
     w: 600,                //Width of the picture
     h: 400,                //Height of the picture
     margin: {top: 10, right: 10, bottom: 10, left: 10}, //The margins of the SVG
     maxDepth: 3,             //reserved. How many levels should be drawn
     strokeColor: "black",           //default stroke color is black
     strokeWidth: 5       //default stroke width is 5
    };
 
     //Put all of the options into a variable called cfg
    if('undefined' !== typeof options){
      for(var i in options){
        if('undefined' !== typeof options[i]){ cfg[i] = options[i]; }
      }//for i
    }//if

    // set the dimensions and margins of the graph
    var margin = cfg.margin,
      width = cfg.w - margin.left - margin.right,
      height = cfg.h - margin.top - margin.bottom;

    //生成方块
    //参数：id: 上级父节点ID
    //参数：node:{ x0, y0, x1, y1, children }
    let buildMondrianRectangle = function(node){
        //const x0=node.x0, y0=node.y0, x1=node.x1, y1=node.y1, children = node.children,
        const {x0,y0,x1,y1,children} = node,
            width = x1 - x0,
            height = y1 - y0;

        //生成色块
        //d3.select("#"+parentId)
        d3.select("g")
            .append("rect")
                .attr("x", x0)
                .attr("y", y0)
                .attr("width", width)
                .attr("height", height)
                .style("fill", node.data.color)
                .style("stroke", cfg.strokeColor)
                .style("stroke-width", cfg.strokeWidth)

        //递归添加下级节点
        if(node.children){
            node.children.forEach(function(n){
                buildMondrianRectangle(n);
            });
        }
    };

    //添加画布append the svg object to the body of the page
    var svg = d3.select(id) //id is top div 
        .append("svg")
          .attr("width", width + margin.left + margin.right)
          .attr("height", height + margin.top + margin.bottom)
        .append("g")
          .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");

    //准备根元素
    const treemap = d3
        .treemap()
        .size([width, height])
        .padding(cfg.strokeWidth)
        .tile(d3.treemapBinary);

    const root = treemap(
        d3.hierarchy(data)
            .sum(d => d.value)
            .sort((a, b) => 0.5 - Math.random())
    );

    //添加所有节点
    console.log("try to build treemap.",root);
    buildMondrianRectangle(root);
    
}//Mondrian


//根据颜色配比得到颜色
//参数值在0-10之间
function chooseMondrianColor(colorRatio){
    var redRatio=colorRatio.red, blueRatio = colorRatio.blue, yellowRatio = colorRatio.yellow, blackRatio = colorRatio.black;
    //console.log("color scheme.",colorRatio);
    const probabilitySpace = [
        ...new Array(redRatio * 10).fill("red"),
        ...new Array(blueRatio * 10).fill("blue"),
        ...new Array(yellowRatio * 10).fill("yellow"),
        ...new Array(blackRatio * 10).fill("black"),
        ...new Array(
            redRatio * 10 + blueRatio * 10 + yellowRatio * 10 + blackRatio * 10
        ).fill("#fffaf1")
    ];

    return d3.shuffle(probabilitySpace)[0];    
}