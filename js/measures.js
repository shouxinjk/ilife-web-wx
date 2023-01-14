// 文档加载完毕后执行
$(document).ready(function ()
{
        //根据屏幕大小计算字体大小
    const oHtml = document.getElementsByTagName('html')[0]
    width = oHtml.clientWidth;
    var rootFontSize = 12 * (width / 1440);// 在1440px的屏幕基准像素为12px
    rootFontSize = rootFontSize <8 ? 8:rootFontSize;//最小为8px
    rootFontSize = rootFontSize >16 ? 16:rootFontSize;//最大为18px
    oHtml.style.fontSize = rootFontSize+ "px";   
    //计算图片流宽度：根据屏幕宽度计算，最小显示2列
    /**
    if(width < 2*columnWidth){//如果屏幕不能并排2列，则调整图片宽度
        columnWidth = (width-columnMargin*4)/2;//由于每一个图片左右均留白，故2列有4个留白
    }    
    //**/
    //显示加载状态
    showloading(true);
    //处理参数
    var args = getQuery();//获取参数
    //category = args["category"]?args["category"]:0; //如果是跳转，需要获取当前目录
    if(args["id"])inputPerson=args["id"];//从请求中获取需要展示的person或personaId
    if(args["categoryId"])categoryId=args["categoryId"];//从获取指定的类目ID
    if(args["categoryName"])categoryName=args["categoryName"];//从获取指定的类目名称
/**
    $('#waterfall').NewWaterfall({
        width: width-20,//1列
        //width: columnWidth,//动态列宽，当前为2列
        delay: 100,
    });
    //**/


    $("body").css("background-color","#fff");//更改body背景为白色

    util.getUserInfo();//从本地加载cookie

    insertDefaultCategory();//如果参数中带有categoryId和categoryName则直接显示到第一个
    
    searchCategory();//默认发起类目检索

    //注册事件：点击搜索后重新查询meta category
    $("#findAll").click(function(){//注册搜索事件：点击搜索全部
        $("#categoryDiv").empty();
        //categoryId = null;
        searchCategory();     
    });   

    //注册点击事件：添加商品URL
    $("#addNewItemBtn").click(function(){
        showItemForm();        
    });   

    //注册点击事件：调整排行榜规则
    $(".button").click(function(){
        if(!rankItemId){ //如果未选中则提示
          siiimpleToast.message('请点选需要调整的指标~~',{
                  position: 'bottom|center'
                });
        }else{//否则调整排序规则
          changeRankItems(rankItemId, $(this).data("action"));
        }    
    }); 

    //初始化排行榜规则显示
    // init Isotope: not work. use jquery directly
    /** 
    rankItemGrid = $('#rankItems').isotope({
      itemSelector: '.element-item',
      layoutMode: 'fitRows',
      getSortData: {
        name: '.name',
        symbol: '.symbol',
        number: '.number parseInt',
        category: '[data-category]',
        priority: function( itemElem ) { //根据priority排序
                  var priority = $( itemElem ).data('priority');
                  return parseFloat( priority );
                }
      }
    });
    $("#rankItems").css("height","40px");
    //**/

    //注册点击事件：创建排行榜
    $("#createRankBtn").click(function(){
        showRankForm();        
    });            

    //装载sankey图必要组件
    require.config({
      baseUrl: 'ext/d3',
      map: {
        '*': {
          'd3-path.js': 'd3-path',
          'd3-array.js': 'd3-array',
          'd3-shape.js': 'd3-shape',
        }
      }
    });
    require(['d3-path','d3-array','d3-shape','d3-sankey'], function (d3Path,d3Array,d3Shape,_d3Sankey) {
        d3Sankey = _d3Sankey;
        console.log("load module d3Sankey. ",d3Sankey);
    });

    //加载broker信息
    loadBrokerInfo();
    //加载达人后再注册分享事件：此处是二次注册，避免达人信息丢失。
    registerShareHandler();  
});

var rankItemGrid = null;//排行榜维度条目grid

var width = 600;
var clientWidth = 600;

var categoryId = null; //记录当前切换的metaCategory。由于启用定时器，切换时有延迟，导致加载的是上一个category商品的情况
var categoryName = ""; //作为推荐搜索关键字，切换类目后用类目名称填写

var columnWidth = 300;//默认宽度300px
var columnMargin = 5;//默认留白5px

var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var items = [];
var page = {//翻页控制
  size: 20,//每页条数
  total: 1,//总页数
  current: -1//当前翻页
};

var persons = [];
var currentPerson = app.globalData.userInfo?app.globalData.userInfo._key:JSON.parse($.cookie('sxUserInfo'))._key;//本地加载当前用户
var currentPersonTagging = "";//记录当前用户的标签清单，用于根据标签显示内容
var currentPersonType = "person";//当前选中的是用户还是画像，默认进入时显示当前用户
var personKeys = [];//标记已经加载的用户key，用于排重

var inputPerson = null;//接收指定的personId或personaId

//临时用户
var tmpUser = "";
//优先从cookie加载达人信息
var broker = {
  id:"system"
};//当前达人
function loadBrokerInfo(){
  broker = util.getBrokerInfo();
}

//load person
function loadPerson(personId) {
    console.log("try to load person info.",personId);
    util.AJAX(app.config.data_api+"/user/users/"+personId, function (res) {
        console.log("load person info.",personId,res);
        syncPerson(res);//提交用户昵称到后端
        //loadBrokerByOpenid(res._key);//根据openid加载broker信息
    });
}
//同步用户信息：将用户昵称及头像同步到后台
function syncPerson(person){
    //同时更新broker的nickname及avatarUrl：由于微信不能静默获取，导致broker内缺乏nickname及avatarUrl
    console.log("try to sync broker info.",person);
    $.ajax({
        url:app.config.sx_api+"/mod/broker/rest/sync/"+person._key,
        type:"post",
        data:JSON.stringify({
            nickname: person.nickName,
            avatarUrl:person.avatarUrl
        }),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },
        success:function(res){
            console.log("sync success.",res);
        },
        error:function(){
            console.log("sync failed.",person);
        }
    });     
}

//根据传入的categoryId和CategoryName显示评价图表
function insertDefaultCategory(){
  if(categoryId){
    //显示类目
    insertCategoryItem({category:categoryId,categoryName:categoryName});

    //显示图表
    showMeasureCharts( categoryName );//加载并显示图表
    loadFeaturedDimensions( );// $(this).data("id") );//加载featured维度及商品数据
    loadFeeds();//加载商品数据 
    
    //高亮
    $("#metacat"+categoryId).css("background-color","green");
    $("#metacat"+categoryId).css("color","#fff");    
  }
}

var sxInterval = null;
function loadFeeds(){
    //先清空原来的
    resetItemsInterval(); //清空定时器及缓存的商品条目

    sxInterval = setInterval(function ()
    {
        //console.log("interval",$(window).scrollTop(),$(document).height(),$(window).height(),$(document).height() - $(window).height() - dist);
        if ($(window).scrollTop() >= $(document).height() - $(window).height() - dist && !loading)
        {
            // 表示开始加载
            loading = true;

            // 加载内容
            if(items.length < num){//如果内容未获取到本地则继续获取
                console.log("try load data by categoryId.",categoryId);
                loadData(categoryId);
            }else{//否则使用本地内容填充
                //console.log("load from locale ");
                insertItem();
            }
        }
    }, 60);
}


//搜索得到metaCategory
function searchCategory() {
    console.log("Measures::searchCategory",$("#searchTxt").val());
    //设置query
    var esQuery = {//搜索控制
      from: 0,
      size: 1000, //默认从1000条中发起搜索
       "query": {
          "bool":{
              "filter":[
                  {
                      "exists": {"field":"categoryId"}
                  }
              ],
              "must":[]
          }
      },
      "collapse": {
          "field": "categoryId"
      },
      "_source": "meta",
      "sort": [
          { "@timestamp": { "order": "desc" } },
          { "_score": { "order": "desc" } }
      ] 
    };

    if($("#searchTxt").val() && $("#searchTxt").val().trim().length>0){
      console.log("add query text to search.",$("#searchTxt").val());
      esQuery.query.bool.must.push({
                      "match" : {"full_text": $("#searchTxt").val()}
                });
    }

    //设置请求头
    var esHeader = {
      "Content-Type": "application/json",
      "Authorization": "Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
    };

    $.ajax({
        url:app.config.search_api+"/stuff/_search", 
        type:"post",
        data:JSON.stringify(esQuery),//注意：nginx启用CORS配置后不能直接通过JSON对象传值
        headers:{
            "Content-Type":"application/json",
            "Authorization":"Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
        },
        crossDomain: true,
        timeout:3000,//设置超时
        success:function(data){
            console.log("Feed::loadData success.",data);
            if(data.hits.total == 0 || data.hits.hits.length==0){//如果没有内容，则显示提示文字
                $("#categoryDiv").append("<div style='font-size:12px;'>没有匹配的条目，请重新尝试</div>");
                shownomore(true);
                showloading(false);
            }else{
                //更新总页数
                var total = data.hits.total;
                page.total = (total + page.size - 1) / page.size;
                //更新当前翻页
                page.current = page.current + 1;
                //装载具体条目
                var hits = data.hits.hits;
                for(var i = 0 ; i < hits.length && i<10; i++){ //最多仅显示10个
                    //items.push(hits[i]._source.item);
                    if(hits[i]._source.meta && hits[i]._source.meta.category && hits[i]._source.meta.categoryName){
                      console.log("got item. ",hits[i]._source.meta);
                      insertCategoryItem(hits[i]._source.meta);
                    }
                    //默认选按照已经传递的categoryId设置当前类目
                    if(categoryId&&categoryId.trim().length>0){//补充categoryName
                      if(categoryId == ""+hits[i]._source.meta.category){
                        categoryName = hits[i]._source.meta.categoryName;
                        //showDimensionCirclePack( hits[i]._source.meta.categoryName );//加载并显示图表
                        showMeasureCharts( hits[i]._source.meta.categoryName );//加载并显示图表

                        loadFeaturedDimensions( );// $(this).data("id") );//加载featured维度及商品数据
                        loadFeeds();//加载商品数据 
                        
                        //高亮
                        $("#metacat"+categoryId).css("background-color","green");
                        $("#metacat"+categoryId).css("color","#fff");

                      }
                    }else if(i==0){ //没有指定则选择第一个
                      console.log("try load items by default. categoryId is ",hits[i]._source.meta.category);

                      categoryId = hits[i]._source.meta.category;
                      categoryName = hits[i]._source.meta.categoryName;
                      //showDimensionCirclePack( hits[i]._source.meta.categoryName );//, $(this).data("id") );//加载并显示图表
                      showMeasureCharts( hits[i]._source.meta.categoryName );//加载并显示图表

                      loadFeaturedDimensions( );// $(this).data("id") );//加载featured维度及商品数据
                      loadFeeds();//加载商品数据 
                      
                      //高亮
                      $("#metacat"+categoryId).css("background-color","green");
                      $("#metacat"+categoryId).css("color","#fff");
                    }
                }
                showloading(false);
            }
        },
        complete: function (XMLHttpRequest, textStatus) {//调用执行后调用的函数
            if(textStatus == 'timeout'){//如果是超时，则显示更多按钮
              console.log("ajax超时",textStatus);
              shownomore(true);
            }
        },
        error: function () {//调用出错执行的函数
            //请求出错处理：超时则直接显示搜索更多按钮
            shownomore(true);
          }
    });
  }

//清空缓存的商品列表、定时器及DOM元素，在切换目录时均需要调用
function resetItemsInterval(){
    //清空商品及定时器
    if(!sxInterval){
      clearInterval(sxInterval);
      sxInterval = null;
    }        
    //恢复当前分页并清空列表
    num = 1;
    page.current = -1;
    items = [];
    dist = 500;
    loading = false;
    $("#Center").empty();
    $("#Center").append('<ul id="waterfall"></ul>');
    $('#waterfall').NewWaterfall({
        width: width-20,//1列
        //width: columnWidth,//动态列宽，当前为2列
        delay: 100,
    });    
}

//根据类目ID获取客观评价维度featured节点
var featuredDimension = [];
function loadFeaturedDimensions(){
    //获取类目下的特征维度列表：注意是同步调用
    $.ajax({
        url:app.config.sx_api+"/mod/itemDimension/rest/featured-dimension",
        type:"get",
        data:{categoryId:categoryId},
        success:function(ret){//json array
            console.log("===got featured dimension===\n",ret);
            featuredDimension = ret;
            if(ret.length>0){
              showLegends(ret);
              console.log("try load feeds by categoryId.",categoryId);             
            }else{
              $("#legendDiv").empty();
            }
        }
    }); 
}

//加载指定item的客观评分
function loadMeasureScores(stuff){
    var itemScore = {};
    //根据itemKey获取评价结果
    //feature = 1；dimensionType：0客观评价，1主观评价
    //注意：由于clickhouse非严格唯一，需要取最后更新值
    $.ajax({
        url:app.config.analyze_api+"?query=select dimensionId,score from ilife.info where feature=1 and dimensionType=0 and itemKey='"+stuff._key+"' order by ts format JSON",
        type:"get",
        //async:false,//同步调用
        //data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },         
        success:function(json){
            console.log("===got item score===\n",json);
            for(var i=0;i<json.rows;i++){
                itemScore[json.data[i].dimensionId] = json.data[i].score;
            }
            console.log("===assemble item score===\n",itemScore);
            showMeasureScores(stuff,itemScore);
        }
    });   
}
//显示客观评价得分
//显示为bar，颜色款宽度10
var scale = 60;//行高60，按照该数值计算颜色块高度
function showMeasureScores(stuff,itemScore){
    //准备评分表格：根据评价维度逐行显示
    var colorIndex = 0;
    if(featuredDimension.length==0){
        var html  = '<div id="mscore-'+stuff._key+'" style="font-size:12px;color:silver">评价数据请稍等</div>';//以itemKey+dimensionId为唯一识别
        $("#measure-"+stuff._key).append(html);
    }else{
      featuredDimension.forEach(function(dimension){
        var score = itemScore[dimension.id]?itemScore[dimension.id]*scale:2;//如果没有则只显示底部边框
        if(colorIndex>colors.length-1)colorIndex=colors.length-1;
        var html  = '<div id="mscore-'+stuff._key+dimension.id+'" style="width:10px;height:'+score+'px;background-color:'+colors[colorIndex]+';">'
                  + '<div style="position:relative;width:10px;margin-top:2px;font-size:8px;vertical-align:top;color:#fff;transform:rotate(90deg);-ms-transform:rotate(90deg);-moz-transform:rotate(90deg);-webkit-transform:rotate(90deg); -o-transform:rotate(90deg);">'
                  +(itemScore[dimension.id]*5).toFixed(1)
                  +'</div>'
                  +'</div>';//以itemKey+dimensionId为唯一识别
        $("#measure-"+stuff._key).append(html);
        colorIndex++; 
      });
    }   
}

//显示评价体系图表：sankey、circlepack、sunburst
//随机显示一张图表
function showMeasureCharts(categoryName){
  $("#sankey").css("display","none");
  $("#circlepack").css("display","none");
  $("#sunburst").css("display","none");
  $("#treemap").css("display","none");
  var idx = new Date().getTime()%3;//仅显示sankey、treemap、sunburst
  if(idx==0){
    $("#sankey").css("display","block");
    linkTree = [];
    linkNodes = [];  
    showSankey();    
  }else if(idx==1){
    $("#treemap").css("display","block");
    showTreemap();
  }else if(idx==2){
    $("#sunburst").css("display","block");
    showSunburst();
  }else{
    $("#circlepack").css("display","block");
    showDimensionCirclePack(categoryName);    
  }
 
}


//图形化显示客观评价树
function showDimensionCirclePack(categoryName){
    //根据category获取客观评价数据
    var data={
        categoryId:categoryId
    };
    console.log("try to load dimension data.",data);
    util.AJAX(app.config.sx_api+"/mod/itemDimension/rest/dim-tree-by-category", function (res) {
        console.log("======\nload dimension.",data,res);
        if (res.length>0) {//显示图形
            console.log("try to show circle pack.",res);
            //显示图表    
            ZoomableCirclePack("#circlepack",{name:categoryName,children:res}, {
              value: d => d.weight, // weight 
              label: d => d.name, // label
              diameter: clientWidth/2
            }); 
            //显示操作提示
            $("#circlepackTip").css("display","block");
            $("#circlepack").css("display","block");
        }else{//没有则啥也不干
            //do nothing
            console.log("failed load dimension tree.",data);
            //隐藏操作提示
            $("#circlepackTip").css("display","none");
            $("#circlepack").css("display","none");
        }
    },"GET",data);    
}

//generate and show sankey chart
//step1: query link tree by meta.category
//step2: query calculated full measure and info data by itemKey
//step3: assemble single item dataset
//step4: show sankey chart    
var d3Sankey = null;
var linkTree = [];
var linkNodes = [];
function showSankey(){
    //获取link tree，包含维度-维度，维度-属性
    $.ajax({
        url:app.config.sx_api+"/mod/itemDimension/rest/link-tree-by-category",
        type:"get",
        //async:false,//同步调用
        data:{categoryId:categoryId},
        success:function(ret){
            console.log("===got link tree===\n",ret);
            linkTree = ret;
            //遍历得到nodes
            linkTree.forEach(function(entry){//逐条解析，将不同节点放入nodes
                //source节点
                var idx = linkNodes.findIndex((node) => node.id==entry.source.id);
                if(idx<0)
                    linkNodes.push(entry.source);
                //target节点
                idx = linkNodes.findIndex((node) => node.id==entry.target.id);
                if(idx<0)
                    linkNodes.push(entry.target);
            });
            generateSankeyChart();//此处触发根据weight显示：因为尚未装载得分
        }
    });  

    //显示标题：
    $("#sankeyTitle").css("display","block");    
}

//显示sankey图，需要在数据ready后开始
function generateSankeyChart(){
    if( linkTree.length==0 || linkNodes.length==0 ){
        console.log("sankey chart not ready. ignore.");
        return;
    }
    //generate sankey chart.
    console.log("try render sankey chart.",linkNodes,linkTree);
    if(d3Sankey){
        var sankeyChartOptions = {
          height:600
        };
        //genrate sankey
        SankeyChart("#sankey", {
                    nodes:linkNodes,
                    links: linkTree
                }, {
                  nodeGroup: d => d.id.split(/\W/)[0], // take first word for color
                  nodeId: d => d.id,
                  nodeLabel: d => d.name, //name显示包含属性名称，即属性原始值或默认值：需要在加载props时设置
                  //format: (f => d => `${f(d)} TWh`)(d3.format(",.1~f")),
                  linkSource: ({source}) => source.id,
                  linkTarget: ({target}) => target.id,
                  height: 600
                });        
    }     
}


function showTreemap(){
    var data = { categoryId: categoryId, parentId: categoryId };
    console.log("try to load dimension data.",data);
    util.AJAX(app.config.sx_api+"/mod/itemDimension/rest/dim-tree", function (res) {
        console.log("======\nload dimension.",data,res);
        var nodes = [];
        if(res){//合并子级指标
            res.forEach(function(node){
                prepareTreemapData(nodes, null, node);
            });
        }           
        generateTreemap( nodes );
    },"GET",data);      
}

//递归将所有指标及属性节点组合为一个列表
function prepareTreemapData(nodes, prefix, node){
    nodes.push({
        name: prefix?prefix+"."+node.name : node.name,
        categoryId: categoryId,
        weight: node.weight
    });
    if(node.children){
        node.children.forEach(function(child){
            prepareTreemapData(nodes, prefix?prefix+"."+node.name:node.name, child);
        });        
    }    
}

//显示treemap图
function generateTreemap(dimtree){
    console.log("start show treemap.",dimtree);
    //显示treemap图表    
    Treemap("#treemap", dimtree, {
      path: d => d.name.replace(/\./g, "/"), // e.g., "flare/animate/Easing"
      value: d => d?d.weight:1, //d?.weight, // size of each node (file); null for internal nodes (folders)
      group: d => d.name.split(".")[0], // e.g., "animate" in "flare.animate.Easing"; for color
      label: (d, n) => [...d.name.split(".").pop().split(/(?=[A-Z][a-z])/g), n.value.toLocaleString("en")].join("\n"),
      title: (d, n) => `${d.name}\n${n.value.toLocaleString("en")}`, // text to show on hover
      link: (d, n) => `${d.href}`,//`https://www.biglistoflittlethings.com/ilife-web-wx/expert/dimension.html?categoryId=${d.categoryId}&id=${d.id}`,
      padding: 2,
      //tile, // e.g., d3.treemapBinary; set by input above
      //width: 600,
      height: 480
    })

    //TODO：当前未生成图片
    /**
    //将生成的客观评价图片提交到fdfs
    var canvas = $("#sunburst svg")[0];
    console.log("got canvas.",canvas);
    //调用方法转换即可，转换结果就是uri,
    var width = $(canvas).attr("width");
    var height = $(canvas).attr("height");
    var options = {
            encoderOptions:1,
            //scale:2,
            scale:1,
            left:-1*Number(width)/2,
            top:-1*Number(height)/2,
            width:Number(width),
            height:Number(height)
        };
    svgAsPngUri(canvas, options, function(uri) {
        //console.log("image uri.",dataURLtoFile(uri,"dimension.png"));
        //将图片提交到服务器端。保存文件文件key为：measure-scheme
        uploadPngFile(uri, "treemap.png", "measure-scheme");//文件上传后将在stuff.media下增加{measure-scheme:imagepath}键值对
    }); 
    //**/ 
}



//显示放射树
function showSunburst(categoryName){
    //根据category获取客观评价数据
    var data={
        categoryId:categoryId
    };
    console.log("try to load dimension data.",data);
    util.AJAX(app.config.sx_api+"/mod/itemDimension/rest/dim-tree-by-category", function (res) {
        console.log("======\nload dimension.",data,res);
        if (res.length>0) {//显示图形
            sunburstNodes = res;
            showSunBurst({name:categoryName&&categoryName.trim().length>0?categoryName:"评价规则",children:res});
        }else{//没有则啥也不干
            //do nothing
            console.log("failed load dimension tree.",data);
        }
    },"GET",data);    
}

function showSunBurst(data){
    //显示sunburst图表    
    Sunburst("#sunburst",data, {
      value: d => d.weight, // weight 
      label: d => d.name, // name
      title: (d, n) => `${n.ancestors().reverse().map(d => d.data.name).join(".")}\n${n.value.toLocaleString("en")}`, // hover text
//      link: (d, n) => n.children
//        ? `https://github.com/prefuse/Flare/tree/master/flare/src/${n.ancestors().reverse().map(d => d.data.name).join("/")}`
//        : `https://github.com/prefuse/Flare/blob/master/flare/src/${n.ancestors().reverse().map(d => d.data.name).join("/")}.as`,
      width: 400,
      height: 400
    });
}

//排行榜设置模板
var rankItemTpl = `
  <div class="element-item post-transition metal " id="rankItem__dimensionid" data-dimensionid="__dimensionid" data-priority="__priority" data-bgcolor="__bgcolor" style="background-color:__bgcolor">
    <h5 class="name" style="font-size:10px;">__name</h5>
    <p class="symbol" data-sort="__sort" id="sort__dimensionid">__sort</p>
    <p class="number">__weight</p>
  </div>
`;
//显示排行榜规则列表，根据最新数据更新
function showRankItems(){
  console.log("show rank items.",rankItems);
  $("#rankItems").empty();//先清空
  var i=0;
  rankItems.forEach(function(rankItem){
    var dimension = rankItem.dimension;
    var rankItemHtml = rankItemTpl;
    rankItemHtml = rankItemHtml.replace(/__dimensionid/g,dimension.id);
    rankItemHtml = rankItemHtml.replace(/__name/g,dimension.name);
    rankItemHtml = rankItemHtml.replace(/__priority/g,rankItem.priority);
    rankItemHtml = rankItemHtml.replace(/__sort/g,(i+1));
    rankItemHtml = rankItemHtml.replace(/__weight/g,dimension.weight+"%");
    rankItemHtml = rankItemHtml.replace(/__bgcolor/g,$("#legendDim"+dimension.id).data("bgcolor"));//使用缓存颜色
    $("#rankItems").append(rankItemHtml);
    //根据priority调整sort显示及背景颜色
    if(rankItem.priority<0){
      $("#sort"+dimension.id).empty();
      $("#sort"+dimension.id).append("-");   
      
      $("#rankItem"+dimension.id).css("background","silver"); 
    }
    //注册点击事件：选中后高亮，并且支持修改排序
    $("#rankItem"+dimension.id).click(function(){
      //设置当前选中条目ID
      rankItemId = $(this).data("dimensionid");
      var currentRankItem = rankItems.find(rankItem => rankItem.dimension.id == rankItemId); //查询得到当前节点元素  
      //修改提示编号为问号，提示调整
      $("#sort"+dimension.id).empty();
      $("#sort"+dimension.id).append("?");

      //修改按钮文字：根据选中条目判断后调整加入或取消排序  
      if(currentRankItem.priority<0){//显示加入排序
        $("#changeBtn").empty();
        $("#changeBtn").data("action","enable");
        $("#changeBtn").append("加入排行");
      }else{//否则显示取消排序
        $("#changeBtn").empty();
        $("#changeBtn").data("action","disable");
        $("#changeBtn").append("移出排行");
      }
    });
    i++;
  });
}

//显示条目评分图例颜色
var legendItemTpl=`
<div id='legendDim__id' data-bgcolor='__bgcolor' style='background-color:__bgcolor;color:#fff;font-size:10px;padding:2px;height:48px;width:__weight%;display: table;_position:relative;overflow:hidden;'>
  <div style='vertical-align: middle;display: table-cell;_position: absolute;_top: 50%;'>
    <div style='_position: relative;_top: -50%;'>
      __name
    </div>
  </div>
</div>
`;
var  colors = ['#8b0000', '#dc143c', '#ff4500', '#ff6347', '#1e90ff','#40e0d0','#0dbf8c','#9acd32','#32cd32','#228b22','#067633'];
var rankItemId = null;
function showLegends(dimensions){
  $("#legendDiv").empty();
  var i=0;
  var priority = 100; //加入排行榜规则列表，最大支持100个维度
  dimensions.forEach(function(dimension){ //仅显示第一层
    //显示到legend图例列表
    var legendItemHtml = legendItemTpl
            .replace(/__id/g,dimension.id)
            .replace(/__name/g,dimension.name)
            .replace(/__weight/g,dimension.weight)
            .replace(/__bgcolor/g,colors[i]);
    $("#legendDiv").append(legendItemHtml);

    //$("#legendDiv").append("<div id='legendDim"+dimension.id+"' data-bgcolor='"+colors[i]+"' style='background-color:"+colors[i]+";color:#fff;font-size:10px;margin:1px;padding:2px;'>"+dimension.name+"</div>");
    
    //检查rankItems是否已装载
    var rankItem = { //注意：不需要设置rankId，后端自动添加到当前rank上
      dimension:dimension,
      priority: priority*10 //默认按照featuredDimension排序
    };
    rankItems.push(rankItem);
    priority--;

    /**
    if(rankItems.length==0){ //如果为空则根据featuredDimension添加
      var priority = 100; //最大支持100个维度
      dimensions.forEach(function(featuredDim){
        var rankItem = { //注意：不需要设置rankId，后端自动添加到当前rank上
          dimension:{
            id: featuredDim.id
          },
          priority: priority*10 //默认按照featuredDimension排序
        };
        rankItems.push(rankItem);
        priority--;
      })
    }
    //**/

    i++;
  });
  //显示评价维度
  showRankItems();
}

//加载用户浏览数据：根据选定用户显示其浏览历史，对于画像则显示该画像下的聚集数据
//currentPersonType: person则显示指定用户的记录，persona显示该画像下所有记录
function loadData() {
    console.log("Feed::loadData",categoryId);
    //设置query
    var esQuery = {//搜索控制
      from: (page.current + 1) * page.size,
      size: page.size,
      "query": {
        "bool": {
          "must": [{
            "nested": {
              "path": "meta",
              "query": {
                "term": {
                  "meta.category": categoryId
                }
              }
            }
          }]
        }
      },
      "sort": [
          { "@timestamp": { "order": "desc" } },
          { "_score": { "order": "desc" } }
      ] 
    };

    //设置请求头
    var esHeader = {
      "Content-Type": "application/json",
      "Authorization": "Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
    };

    console.log("try to search stuff.",JSON.stringify(esQuery), esQuery);

    $.ajax({
        url:app.config.search_api+"/stuff/_search", 
        type:"post",
        data:JSON.stringify(esQuery),//注意：nginx启用CORS配置后不能直接通过JSON对象传值
        headers:{
            "Content-Type":"application/json",
            "Authorization":"Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
        },
        crossDomain: true,
        timeout:3000,//设置超时
        success:function(data){
            console.log("Feed::loadData success.",data);
            if(data.hits.total == 0 || data.hits.hits.length==0){//如果没有内容，则显示提示文字
                shownomore(true);
                showloading(false);
            }else{
                //更新总页数
                var total = data.hits.total;
                page.total = (total + page.size - 1) / page.size;
                //更新当前翻页
                page.current = page.current + 1;
                //装载具体条目
                var hits = data.hits.hits;
                for(var i = 0 ; i < hits.length ; i++){
                    items.push(hits[i]._source);
                }
                insertItem();
                showloading(false);
            }
        },
        complete: function (XMLHttpRequest, textStatus) {//调用执行后调用的函数
            if(textStatus == 'timeout'){//如果是超时，则显示更多按钮
              console.log("ajax超时",textStatus);
              shownomore(true);
            }
        },
        error: function () {//调用出错执行的函数
            //请求出错处理：超时则直接显示搜索更多按钮
            shownomore(true);
          }
    });
  }


//将item显示到页面
//logo、平台、标题、标价+售价+优惠券、店返+团返+积分、评价数据、点击后跳转到详情页面
function insertItem(){
    // 加载内容
    var item = items[num-1];
    console.log("try insert stuff item.",item);
    if(!item){
      shownomore(true);
      return;
    }
    //排重
    if($("#"+item._key).length>0)
      return;
    //var imgWidth = columnWidth-2*columnMargin;//注意：改尺寸需要根据宽度及留白计算，例如宽度为360，左右留白5，故宽度为350
    var imgWidth = 48;//固定为100
    var imgHeight = random(50, 300);//随机指定初始值
    //计算图片高度
    var imgSrc = item.logo?item.logo.replace(/\.avif/g,""):item.images[0].replace(/\.avif/g,"");
    var img = new Image();
    img.src = imgSrc;
    var orgWidth = img.width;
    var orgHeight = img.height;
    imgHeight = orgHeight/orgWidth*imgWidth;
    //计算文字高度：按照1倍行距计算
    //console.log("orgwidth:"+orgWidth+"orgHeight:"+orgHeight+"width:"+imgWidth+"height:"+imgHeight);
    var image = "<img src='"+imgSrc+"' width='"+imgWidth+"' height='"+imgHeight+"'/>"
    //var title = "<span class='title'><a href='info.html?category="+category+"&id="+item._key+"'>"+item.title+"</a></span>"
    
    var tagTmpl = "<a class='itemTag' href='index-metrics.html?keyword=__TAGGING'>__TAG</a>";
   var highlights = "<div class='itemTags'>";
    highlights += "<a class='itemTagPrice' href='#'>"+(item.price.currency?item.price.currency:"¥")+item.price.sale+"</a>";
    if(item.price.coupon>0){
        highlights += "<span class='couponTip'>券</span><span class='coupon' href='#'>"+item.price.coupon+"</span>";
    }    
    highlights += tagTmpl.replace("__TAGGING",item.distributor.name).replace("__TAG",item.distributor.name).replace("itemTag","itemTagDistributor");
    highlights += '<span id="jumpbtn'+item._key+'" class="jumpbtn">&nbsp;&nbsp;立即前往&nbsp;&nbsp;</span>';
    highlights += "</div>";

    var profitTags = "";

    if(item.profit&&item.profit.type=="3-party"){//如果已经存在则直接加载
      if(item.profit&&item.profit.order){
          profitTags += "<span class='profitTipOrder'>店返</span><span class='itemTagProfitOrder' href='#'>¥"+(parseFloat((Math.floor(item.profit.order*10)/10).toFixed(1)))+"</span>";
          if(item.profit&&item.profit.team&&item.profit.team>0.1)profitTags += "<span class='profitTipTeam'>团返</span><span class='itemTagProfitTeam' href='#'>¥"+(parseFloat((Math.floor(item.profit.team*10)/10).toFixed(1)))+"</span>";
      }else if(item.profit&&item.profit.credit&&item.profit.credit>0){
          profitTags += "<span class='profitTipCredit'>积分</span><span class='itemTagProfitCredit' href='#'>"+(parseFloat((Math.floor(item.profit.credit*10)/10).toFixed(0)))+"</span>";
      }
    }

    if(profitTags.trim().length>0){
        profitTags = "<div id='profit"+item._key+"' class='itemTags profit-show'>"+profitTags+"</div>";
    }else{
        profitTags = "<div id='profit"+item._key+"' class='itemTags profit-hide'></div>";
    }     

    //属性列表
    var propTags = "<div class='title' style='line-height:12px;font-size:10px;'>";//显示原始属性键值对
    if(item.props && item.props instanceof Array){ //兼容采用数组存储的条目
        item.props.forEach(function(obj){
            Object.keys(obj).forEach(function(key){
                propTags += key +": "+obj[key]+"<br/>";
            });
        });
    }else if(item.props){
        Object.keys(item.props).forEach(function(key){
            propTags += key +": "+item.props[key]+"<br/>";
        });
    }
    propTags += "</div>";

    //商品tag列表
    var itemTags = "<div class='title' style='font-size:10px;'>";//显示原始属性键值对
    if(item.tags){
        Object.keys(item.tags).forEach(function(key){
            itemTags += "<span style='padding:1px 2px;margin:1px;background-color:#8BCE2D;border-radius:5px;color:#fff;'>"+item.tags[key]+"</span>";
        });
    }
    //手动标注tag列表
    if(item.tagging){
        item.tagging.split(" ").forEach(function(tag){
            itemTags += "<span style='padding:1px 2px;margin:1px;background-color:#E85552;border-radius:5px;color:#fff;'>"+tag+"</span>";
        });
    }
    itemTags += "</div>";

    //价格
    var priceStr = "";
    if(item.price.bid && item.price.bid>item.price.sale){
      priceStr += "<div style='text-decoration: line-through;color:grey;'>"+item.price.bid+"</div>";
    }    
    priceStr += "<div style='color:darkred;'>" + (item.price.currency?item.price.currency:"￥")+item.price.sale + "</div>";

    /**
    if(item.price.coupon){
      priceStr += "<div style='text-decoration: color:orange;'>"+item.price.coupon+"</div>";
    }
    //**/

    var metaCategory = "";
    if(item.meta&&item.meta.categoryName){
        metaCategory = "<div class='title'>"+item.meta.categoryName+"</div>"
    }
    var title = "<div class='title' style='font-size:12px;line-height: 14px;overflow: hidden; text-overflow: ellipsis;display: -webkit-box;-webkit-line-clamp: 4;-webkit-box-orient: vertical;'>"+item.distributor.name+" "+item.title+"</div>"
    $("#waterfall").append("<li><div id='"+item._key+"' style='display:flex;flex-direct:row;width:96%;height:50px;'>" 
        + "<div style='width:15%;margin:auto;'>"+ image +"</div>"
        + "<div style='width:35%;margin:auto 0px;'>"+ title +"</div>"
        + "<div style='width:20%;margin:auto 0px;font-size:12px;font-weight:bold;text-align:center;'>"+ priceStr +"</div>"
        + "<div style='width:30%;margin:auto 0px;display:flex;flex-direct:row;justify-content:space-around;align-items:flex-end;flex-wrap:nowrap;' id='measure-"+item._key+"'></div>"
        + "</div></li>");
    num++;

    //装载评价数据：查询后动态添加
    if(item.meta&&item.meta.category){
      loadMeasureScores(item);
    }

    //注册事件
    $("#"+item._key).click(function(){
        //跳转到详情页
        window.location.href = "info2.html?id="+item._key;
    });

    // 表示加载结束
    loading = false;
}

//显示没有更多内容
function shownomore(flag){
  //检查是否是一条数据都没加载
  if(items.length==0){//需要特别处理：如果没有任何数据，则需要默认设置，否则导致无法显示show more btn
    $("#waterfall").height(10);
    $("#no-results-tip").toggleClass("no-result-tip-hide",false);
    $("#no-results-tip").toggleClass("no-result-tip-show",true);
  }    
  if(flag){
    $("#findMoreBtn").toggleClass("findMoreBtn-hide",false);
    $("#findMoreBtn").toggleClass("findMoreBtn-show",true);
    //注册跳转事件：跳转到推荐页，需要带有当前用户ID
    $("#findMoreBtn").click(function(){
      window.location.href = "index.html?keyword="+categoryName;
    });    
  }else{
    $("#findMoreBtn").toggleClass("findMoreBtn-hide",true);
    $("#findMoreBtn").toggleClass("findMoreBtn-show",false);
  }
}

//显示正在加载提示
function showloading(flag){
  if(flag){
    $("#loading").toggleClass("loading-hide",false);
    $("#loading").toggleClass("loading-show",true);
  }else{
    $("#loading").toggleClass("loading-hide",true);
    $("#loading").toggleClass("loading-show",false);    
  }
}

//将item显示到页面
function insertCategoryItem(measureItem){
    if(!measureItem){
      shownomore(true);
      return;
    }
    //限制显示条数，仅显示8个
    if($("div[id^=metacat]").length>7){
      console.log("too many meta categories. ignore.");
      return;
    }
    //隐藏no-more-tips
    $("#no-results-tip").toggleClass("no-result-tip-hide",true);
    $("#no-results-tip").toggleClass("no-result-tip-show",false); 
    
    var measureTag = "<div id='metacat"+measureItem.category+"' data-id='"+measureItem.category+"' data-name='"+measureItem.categoryName+"' style='line-height:16px;font-size:12px;min-width:60px;font-weight:bold;padding:2px;border:1px solid silver;border-radius:10px;margin:2px;'>"+measureItem.categoryName+"</div>"
    $("#categoryDiv").append( measureTag );

    //调整sticky高度
    //console.log("change legned div stikcy height.",$("#categoryDiv").css("height"));
    var stickyTop = 54+Number($("#categoryDiv").css("height").replace(/px/,""));
    $("#legendDivSticky").css("top",stickyTop+"px");


    //注册事件
    $("#metacat"+measureItem.category).click(function(){
        console.log("meta category changed. ",  $(this).data("id") );

        categoryId = ""+$(this).data("id"); //设置全局变量，避免interval延迟调用问题
        categoryName = $(this).data("name"); //设置全局变量，避免interval延迟调用问题

        //修改类目后重新注册分享事件
        registerShareHandler(); 

        //showDimensionCirclePack( $(this).data("name"));//, $(this).data("id") );//加载并显示图表
        showMeasureCharts($(this).data("name"));

        loadFeaturedDimensions( );// $(this).data("id") );//加载featured维度及商品数据
        loadFeeds();//加载商品数据 

        //高亮
        $("div[id^=metacat]").css("background-color","#fff");
        $("div[id^=metacat]").css("color","#000");          
        $("#metacat"+categoryId).css("background-color","green");
        $("#metacat"+categoryId).css("color","#fff");        
    });

    // 表示加载结束
    showloading(false);
    loading = false;      
}

// 自动加载更多：此处用于测试，动态调整图片高度
function random(min, max)
{
    return min + Math.floor(Math.random() * (max - min + 1))
}

// 时间戳转多少分钟之前
function getDateDiff(dateTimeStamp) {
    // 时间字符串转时间戳
    var timestamp = new Date(dateTimeStamp).getTime();
    var minute = 1000 * 60;
    var hour = minute * 60;
    var day = hour * 24;
    var halfamonth = day * 15;
    var month = day * 30;
    var year = day * 365;
    var now = new Date().getTime();
    var diffValue = now - timestamp;
    var result;
    if (diffValue < 0) {
        return;
    }
    var yearC = diffValue / year;
    var monthC = diffValue / month;
    var weekC = diffValue / (7 * day);
    var dayC = diffValue / day;
    var hourC = diffValue / hour;
    var minC = diffValue / minute;
    if (yearC >= 1) {
        result = "" + parseInt(yearC) + "年前";
    } else if (monthC >= 1) {
        result = "" + parseInt(monthC) + "月前";
    } else if (weekC >= 1) {
        result = "" + parseInt(weekC) + "周前";
    } else if (dayC >= 1) {
        result = "" + parseInt(dayC) + "天前";
    } else if (hourC >= 1) {
        result = "" + parseInt(hourC) + "小时前";
    } else if (minC >= 1) {
        result = "" + parseInt(minC) + "分钟前";
    } else
        result = "刚刚";
    return result;
}

//记录排行榜规则条目，并检查排行榜唯一性。注意：在保存前，rankId及rankItemId均未生成，根据dimensionId完成排序及唯一性检查
//操作包括前移、后移、启用、禁用。禁用时优先级直接变为-1，启用后变为0，前移后移动则通过计算得到
//实际存储时，按照priority倒序排列
var rankItems = [];
function changeRankItems(dimensionId, action){
  //根据操作类型计算priority
  var idx = rankItems.findIndex(rankItem => rankItem.dimension.id == dimensionId); //查询得到当前节点下标
  var currentRankItem = rankItems.find(rankItem => rankItem.dimension.id == dimensionId); //查询得到当前节点元素
  if("disable"==action){ //禁用时直接设置为-1
    //需要检查保证至少有一个维度
    var totalEnabled = 0;
    rankItems.forEach(function(item){
      if(item.priority>0)totalEnabled++;
    });
    if(totalEnabled<2){ //如果仅有一个则拒绝
        siiimpleToast.message('至少要有一个参与排行~~',{
                position: 'bottom|center'
              }); 
        return;            
    }
    currentRankItem.priority = -1 * new Date().getTime();//放到最后
    rankItems.splice(idx,1);//删除元素
    rankItems.push(currentRankItem);//添加为最后一个
  }else if("enable"==action){ //作为最后一个，需要查询当前最后一个，并且设置priority为其一半
    //遍历得到目标位置
    var toIdx = 0;
    var priority = 0;
    rankItems.forEach(function(rankItem){
      if(rankItem.priority>0){
        priority = rankItem.priority;
        toIdx ++;
      }
    });
    currentRankItem.priority = priority/2;//放到最后
    rankItems.splice(idx,1);//删除当前元素
    //插入目标位置之后
    rankItems.splice(toIdx+1,0,currentRankItem);//插入到目标位置之后
  }else if("up"==action){ //前移一个，查询前一个，两者交换priority
    var priority = currentRankItem.priority;
    //如果未加入排序则提示先加入排序
    if(priority<0){
        siiimpleToast.message('请先加入排行~~',{
                position: 'bottom|center'
              }); 
        return;        
    }
    if(idx>0){//仅对非第一个进行操作
      var toIdx = idx-1;
      var toRankItem = rankItems[toIdx];
      currentRankItem.priority = toRankItem.priority;
      toRankItem.priority = priority;
      rankItems.splice(idx,1,toRankItem);//替换当前元素
      rankItems.splice(toIdx,1,currentRankItem);//替换前一个元素
    }
  }else if("down"==action){ //后移一个，查询后一个，两者交换priority
    var priority = currentRankItem.priority;
    //如果未加入排序则提示先加入排序
    if(priority<0){
        siiimpleToast.message('请先加入排行~~',{
                position: 'bottom|center'
              }); 
        return;        
    }    
    if(idx<rankItems.length-1){//仅对非最后一个进行操作
      var toIdx = idx+1;
      var toRankItem = rankItems[toIdx];
      currentRankItem.priority = toRankItem.priority;
      toRankItem.priority = priority;
      rankItems.splice(idx,1,toRankItem);//替换当前元素
      rankItems.splice(toIdx,1,currentRankItem);//替换后一个元素
    }
  }

  //更改界面显示:包括颜色及位置
  if(currentRankItem.priority<0){ //显示为灰色，sort显示为-
    $("#sort"+dimensionId).empty();
    $("#sort"+dimensionId).append("-");
    $("#rankItem"+dimensionId).css("background","silver");
    //调整按钮
    $("#changeBtn").empty();
    $("#changeBtn").data("action","enable");
    $("#changeBtn").append("加入排行");
  }else{//显示原本颜色，并恢复sort显示
    $("#sort"+dimensionId).empty();
    $("#sort"+dimensionId).append($("#sort"+dimensionId).data("sort"));
    $("#rankItem"+dimensionId).css("background",$("#rankItem"+dimensionId).data("bgcolor"));
    //调整按钮
    $("#changeBtn").empty();
    $("#changeBtn").data("action","disable");
    $("#changeBtn").append("移出排行");
  }  

  //显示评价维度：根据调整结果刷新
  /**
  rankItemGrid.isotope({ sortBy: "priority" });
  $("#rankItems").css("height","40px");
  //**/
  showRankItems();

  //根据修改后的排序检查唯一性，如果已经有排行榜存在则提示
  var rankId = getRankId();
  console.log("check rank by id.",rankId);
  $.ajax({
      url:app.config.sx_api+"/mod/rank/rest/rank/"+rankId,
      type:"get",
      //data:JSON.stringify({}),//注意：不能使用JSON对象
      headers:{
          "Content-Type":"application/json",
          "Accept": "application/json"
      },  
      success:function(ret){
          console.log("===got rank info===\n",ret);
          if(ret.success && ret.rank){ //表示已存在，需要提示
              $("#rankTip").empty();
              $("#rankTip").append("排行榜已存在，可<a href='billboard.html?rankId="+rankId+"'>直接查看</a>");
              $("#rankTip").data("rankid",rankId);
          }else{ //不存在，可以继续创建
              $("#rankTip").empty();
              $("#rankTip").append("创建"+(categoryName?categoryName:"")+"排行榜");
              $("#rankTip").data("rankid","");
          }
      }
  });
}

//保存排行榜：完成后关闭浮框，并且跳转到排行榜界面
function saveRankInfo(rank){
    if($("#rankTip").data("rankid") && $("#rankTip").data("rankid").trim().length>0){ //如果排行榜已存在，则提示不预创建
        siiimpleToast.message('排行榜已存在~~',{
                position: 'bottom|center'
              }); 
        return;      
    }
    //设置rank信息
    rank.id = getRankId();//设置id
    var finalRankItems = [];//仅保留priority>0的items
    rankItems.forEach(function(item){
      if(item.priority>0){
        finalRankItems.push(item);
      }
    })
    rank.items = finalRankItems;//添加items
    //保存rank
    console.log("try to save rank info.",rank);
    $.ajax({
        url:app.config.sx_api+"/mod/rank/rest/rank",
        type:"post",
        data:JSON.stringify(rank),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===save rank done===\n",ret);
            if(ret.success){ 
                //取消浮框，并刷新界面
                $.unblockUI(); //直接取消即可
                window.location.href="billboard.html?rankId="+ret.data.id;
            }else{
              siiimpleToast.message('啊哦，出错了~~',{
                      position: 'bottom|center'
                    });    
            }
        }
    });
}

//生成rankId 根据所有enable的维度及keyword做唯一性校验
function getRankId(){
  var str = "";
  rankItems.forEach(function(rankItem){
    if(rankItem.priority>0) //仅考虑纳入排行规则的维度
      str += rankItem.dimension.id;
  });
  if( $("#rankKeywords2").val() && $("#rankKeywords2").val().trim().length>0){
    str += $("#rankKeywords2").val().trim();
  }
  return hex_md5(str);
}

//显示建立排行榜表单：输入名称、keywords、描述，并支持调整排行规则
function showRankForm(){
    console.log("show rank form.");  
    //设置默认值
    $("#rankTip").empty();
    $("#rankTip").append("创建"+(categoryName?categoryName:"")+"排行榜");

    $("#rankName2").attr("placeholder","名称，如 XXX "+(categoryName?categoryName:"")+" 排行榜， 必填");

    $("#rankCategory2").val("类目："+categoryName);
    if($("#rankKeywords2").val().trim().length==0 && $("#searchTxt").val().trim().length>0 ){
      $("#rankKeywords2").val( $("#searchTxt").val().trim() );
    }
    //显示表单
    $.blockUI({ message: $('#rankform'),
        css:{ 
            padding:        10, 
            margin:         0, 
            width:          '80%', 
            top:            '20%', 
            left:           '10%', 
            textAlign:      'center', 
            color:          '#000', 
            border:         '1px solid silver', 
            backgroundColor:'#fff', 
            cursor:         'normal' 
        },
        overlayCSS:  { 
            backgroundColor: '#000', 
            opacity:         0.7, 
            cursor:          'normal' 
        }
    }); 
    $("#btnCancelRank").click(function(){
        $("#itemUrl").css("border","1px solid silver");//恢复标准风格       
        $.unblockUI(); //直接取消即可
    });
    $("#btnSaveRank").click(function(){//提交后创建排行榜
        //检查必填项：名称。排行规则在切换时已经检查
        if( !$("#rankName2").val() || $("#rankName2").val().trim().length ==0 ){
            siiimpleToast.message('名称为必填~~',{
              position: 'bottom|center'
            });                 
        }else if( !$("#rankDesc2").val() || $("#rankDesc2").val().trim().length ==0 ){
            siiimpleToast.message('简介为必填~~',{
              position: 'bottom|center'
            });                 
        }else{
            console.log("try to save rank.");
            var rank = {
              id: "",//设置为空将自动根据items计算
              isNewRecord: true,//做为新排行榜建立
              category:{
                id: categoryId
              },
              name: $("#rankName2").val(),
              description: $("#rankDesc2").val(),
              keywords: $("#rankKeywords2").val()?$("#rankKeywords2").val().trim():"",
              openid: app.globalData.userInfo._key,
              nickname: app.globalData.userInfo.nickname
            }           
            saveRankInfo(rank);
        }
    });
}

//显示增加商品表单：粘贴URL即可
function showItemForm(){
    console.log("show item form.");  
    //显示数据填报表单
    $.blockUI({ message: $('#itemform'),
        css:{ 
            padding:        10, 
            margin:         0, 
            width:          '80%', 
            top:            '30%', 
            left:           '10%', 
            textAlign:      'center', 
            color:          '#000', 
            border:         '1px solid silver', 
            backgroundColor:'#fff', 
            cursor:         'normal' 
        },
        overlayCSS:  { 
            backgroundColor: '#000', 
            opacity:         0.7, 
            cursor:          'normal' 
        }
    }); 
    $("#btnCancel").click(function(){
        $("#itemUrl").css("border","1px solid silver");//恢复标准风格
        $("#itemUrl").val("");//清空原有数值，避免交叉        
        $.unblockUI(); //直接取消即可
    });
    $("#btnPublish").click(function(){//完成阅读后的奖励操作
        //检查数字url，胡乱填写不可以
        if( !isUrlValid($("#itemUrl").val()) ){
            $("#itemUrl").css("border","1px solid red");
            $("#itemUrl").val("");//清空原有数值，避免交叉
            siiimpleToast.message('需要包含URL链接才可以哦~~',{
              position: 'bottom|center'
            });                 
        }else{
            console.log("try to submit new item.");
            submitNewItem();
        }
    });
}

//检查url是否符合要求：包含链接即可
function isUrlValid(url) {
    return /^https?:\/\//i.test(url);
}

//添加商品：提交URL后尝试自动采集入库
function submitNewItem(){
    var url = $("#itemUrl").val();
    $("#enhouseWaiting").css("display","block");
    $("#enhouseTip").html("商品上架中，稍等一下下哦~~");
    $.ajax({ //先判断URL是否支持
        url:app.config.sx_api+"/mod/linkTemplate/rest/convert",
        type:"post",
        data:JSON.stringify({
            url:url,
        }),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },        
        success:function(res){
            console.log("url convert succeed.",res);
            if(res.success && res.url && res.url.trim().length>0){//是支持的URL
                $.ajax({
                    url:app.config.sx_api+"/rest/cps/enhouse",
                    type:"post",
                    data:JSON.stringify({
                        url:res.url,
                        text:$("#itemUrl").val(),
                        openid:app.globalData.userInfo._key,
                    }),//注意：不能使用JSON对象
                    headers:{
                        "Content-Type":"application/json",
                        "Accept": "application/json"
                    },        
                    success:function(res){
                        console.log("item submit succeed.",res);
                        $.unblockUI(); //屏幕解锁
                        $("#itemUrl").css("border","1px solid silver");//恢复标准风格
                        $("#itemUrl").val("");//清空原有数值，避免交叉   
                        $("#enhouseWaiting").css("display","none");
                        $("#enhouseTip").html("粘贴商品URL");                     
                        
                        //直接跳转到详情页
                        if(res.success && res.data && res.data.itemKey && res.data.itemKey.trim().length>0){//表示已存在或采集成功
                          siiimpleToast.message('商品已添加，请查看详情~~',{
                                      position: 'bottom|center'
                                    }); 
                          window.location.href="info2.html?id="+res.data.itemKey;
                        }else if(res.type == "nocps"){
                          siiimpleToast.message('糟糕，没查到商品信息~~',{
                                  position: 'bottom|center'
                                });               
                        }else{
                          siiimpleToast.message('已转发客服，稍后推送通知~~',{
                                  position: 'bottom|center'
                                });               
                        }     
                    },
                    error:function(res){
                        console.log("item submit succeed.",res);
                        $.unblockUI(); //屏幕解锁
                        $("#itemUrl").css("border","1px solid silver");//恢复标准风格
                        $("#itemUrl").val("");//清空原有数值，避免交叉   
                        $("#enhouseWaiting").css("display","none");
                        $("#enhouseTip").html("粘贴商品URL");                     
                        siiimpleToast.message('啊哦，好像出错了~~',{
                                position: 'bottom|center'
                              });                   
                    }, 
                    timeout: 5000       
                }); 
            }else{
              siiimpleToast.message('还不支持这个平台哦~~',{
                      position: 'bottom|center'
                    });               
            }     
        }      
    })     
}


function registerShareHandler(){
    //计算分享达人：如果当前用户为达人则使用其自身ID，如果当前用户不是达人则使用页面本身的fromBroker，如果fromBroker为空则默认为system
    var shareBrokerId = "system";//默认为平台直接分享
    if(broker&&broker.id){//如果当前分享用户本身是达人，则直接引用其自身ID
        shareBrokerId=broker.id;
    }else if(fromBroker && fromBroker.trim().length>0){//如果当前用户不是达人，但页面带有前述达人，则使用前述达人ID
        shareBrokerId=fromBroker;
    }
    //计算分享用户：如果是注册用户则使用当前用户，否则默认为平台用户
    var shareUserId = "system";//默认为平台直接分享
    if(tmpUser&&tmpUser.trim().length>0){//如果是临时用户进行记录。注意有时序关系，需要放在用户信息检查之前。
        shareUserId = tmpUser;
    }
    if(app.globalData.userInfo && app.globalData.userInfo._key){//如果为注册用户，则使用当前用户
        shareUserId = app.globalData.userInfo._key;
    }

    //准备分享url，需要增加分享的 fromUser、fromBroker信息
    var shareUrl = window.location.href.replace(/measures/g,"share");//需要使用中间页进行跳转
    if(shareUrl.indexOf("?")>0){//如果本身带有参数，则加入到尾部
        shareUrl += "&fromUser="+shareUserId;
        shareUrl += "&fromBroker="+shareBrokerId;
    }else{//否则作为第一个参数增加
        shareUrl += "?fromUser="+shareUserId;
        shareUrl += "&fromBroker="+shareBrokerId;        
    }
    //添加categoryId
    if(categoryId && categoryId.trim().length>0){
      shareUrl += "&categoryId="+categoryId;
    }
    shareUrl += "&origin=measures";//添加源，表示是一个列表页分享

    $.ajax({
        url:app.config.auth_api+"/wechat/jssdk/ticket",
        type:"get",
        data:{url:window.location.href},//重要：获取jssdk ticket的URL必须和浏览器浏览地址保持一致！！
        success:function(json){
            console.log("===got jssdk ticket===\n",json);
            wx.config({
                debug:false, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
                appId: json.appId, // 必填，公众号的唯一标识
                timestamp:json.timestamp , // 必填，生成签名的时间戳
                nonceStr: json.nonceStr, // 必填，生成签名的随机串
                signature: json.signature,// 必填，签名
                jsApiList: [
                   // 'onMenuShareTimeline', 'onMenuShareAppMessage','onMenuShareQQ', 'onMenuShareWeibo', 'onMenuShareQZone',
                  'updateAppMessageShareData',
                  'updateTimelineShareData',
                  'onMenuShareAppMessage',
                  'onMenuShareTimeline',
                  'chooseWXPay',
                  'showOptionMenu',
                  "hideMenuItems",
                  "showMenuItems",
                  "onMenuShareTimeline",
                  'onMenuShareAppMessage'                   
                ] // 必填，需要使用的JS接口列表
            });
            wx.ready(function() {
                // config信息验证后会执行ready方法，所有接口调用都必须在config接口获得结果之后，config是一个客户端的异步操作，所以如果需要在页面加载时就调用相关接口，
                // 则须把相关接口放在ready函数中调用来确保正确执行。对于用户触发时才调用的接口，则可以直接调用，不需要放在ready函数中。
                //分享到朋友圈
                wx.onMenuShareTimeline({
                    title:(categoryName&&categoryName.trim().length>0?categoryName:"小确幸大生活")+"排行榜", // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg", // 分享图标
                    success: function () {
                        // 用户点击了分享后执行的回调函数
                        //TODO: solution分享当前不记录
                        /*
                        logstash(stuff,"mp","share timeline",shareUserId,shareBrokerId,function(res){
                            console.log("分享到朋友圈",res);
                        }); 
                        //**/
                    },
                });
                //分享给朋友
                wx.onMenuShareAppMessage({
                    title:(categoryName&&categoryName.trim().length>0?categoryName:"小确幸大生活")+"排行榜", // 分享标题
                    desc:"完整的评价体系，全面的数据，发现更多更真实的信息", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: "http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg", // 分享图标
                    type: 'link', // 分享类型,music、video或link，不填默认为link
                    dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
                    success: function () {
                      // 用户点击了分享后执行的回调函数
                      //TODO:solution分享当前不记录
                      /**
                        logstash(stuff,"mp","share appmsg",shareUserId,shareBrokerId,function(res){
                            console.log("分享到微信",res);
                        }); 
                        //**/
                    }
                });   
                //分享到朋友圈
                wx.updateTimelineShareData({
                    title:(categoryName&&categoryName.trim().length>0?categoryName:"小确幸大生活")+"排行榜", // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg", // 分享图标
                    success: function () {
                        // 用户点击了分享后执行的回调函数
                        //TODO: solution分享当前不记录
                        /*
                        logstash(stuff,"mp","share timeline",shareUserId,shareBrokerId,function(res){
                            console.log("分享到朋友圈",res);
                        }); 
                        //**/
                    },
                });
                //分享给朋友
                wx.updateAppMessageShareData({
                    title:(categoryName&&categoryName.trim().length>0?categoryName:"小确幸大生活")+"排行榜", // 分享标题
                    desc:"完整的评价体系，全面的数据，发现更多更真实的信息", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: "http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg", // 分享图标
                    type: 'link', // 分享类型,music、video或link，不填默认为link
                    dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
                    success: function () {
                      // 用户点击了分享后执行的回调函数
                      //TODO:solution分享当前不记录
                      /**
                        logstash(stuff,"mp","share appmsg",shareUserId,shareBrokerId,function(res){
                            console.log("分享到微信",res);
                        }); 
                        //**/
                    }
                });                          
            });
        }
    })    
}
