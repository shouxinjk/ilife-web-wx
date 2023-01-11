// 文档加载完毕后执行
$(document).ready(function ()
{
    //根据屏幕大小计算字体大小
    const oHtml = document.getElementsByTagName('html')[0]
    const width = oHtml.clientWidth;
    var rootFontSize = 12 * (width / 1440);// 在1440px的屏幕基准像素为12px
    rootFontSize = rootFontSize <8 ? 8:rootFontSize;//最小为8px
    rootFontSize = rootFontSize >16 ? 16:rootFontSize;//最大为18px
    oHtml.style.fontSize = rootFontSize+ "px";   

    var args = getQuery();//获取参数

    //显示加载状态
    //showloading(true);
    //处理参数
    var args = getQuery();//获取参数
    if(args["from"]){
        from = args["from"]; //需要修改的用户ID
    }    
   
    if(args["categoryId"]){
        categoryId = args["categoryId"]; 
    }
    if(args["categoryName"]){
        categoryName = args["categoryName"]; 
        $("#treemapTitle").prepend("<span style='padding:0 2px;/*color:#007bff;*/'>"+categoryName+"</span>");
    }    

    $("body").css("background-color","#fff");//更改body背景为白色

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });      
    //loadPerson(currentPersonId);//加载需要修改的用户信息

    //注册事件：直接进入首页，通过切换画像得到
    $("#vailidateBtn").click(function(e){
        window.location.href="../index.html?categoryId="+categoryId;
    });

    //加载需要类型
    loadNeedTypes();

    //加载所有类目列表：注意是加载全部类目
    loadCategories();//加载后将自动高亮，并加载需要数据

    //加载维度定义数据
    //loadCategoryNeeds();

    //注册事件：切换菜单
    $("#personaNeedsFilter").click(function(e){
        window.location.href = "need-persona.html";
    });
    $("#phaseNeedsFilter").click(function(e){
        window.location.href = "need-phase.html";
    });
    $("#categoryNeedsFilter").click(function(e){
        window.location.href = "need-category.html";
    }); 

});

util.getUserInfo();//从本地加载cookie

var columnWidth = 800;//默认宽度600px
var columnMargin = 5;//默认留白5px
var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var items = [];//所有画像列表
var page = {
    size:20,//每页条数
    total:1,//总页数
    current:-1//当前翻页
};

var currentActionType = '';//当前操作类型
var tagging = '';//操作对应的action 如buy view like 等

var from = "my";//可选值为my/connections,默认认为是自己修改自己

var currentPersonId = app.globalData.userInfo?app.globalData.userInfo._key:null;//默认为当前登录用户
var userInfo=app.globalData.userInfo;//默认为当前用户

var currentPersonaId = null;
var currentPersona = {};
var currentConnection = null;
var currentPerson = {};//默认当前修改用户为空

var categoryId = null;
var categoryName = null;
var categoryNeeds = [];//关联的need列表
var needTypes = {};//需要类型
var needType = null;//当前选中的needType
var needTypeColor = { //颜色表
    alpha:"#A49EE2",
    beta:"#40B4E7",
    gamma:"#8BCE2D",
    delte:"#F6B100",
    epsilon:"#E85552"
};
var needTypeWeightSum={
    alpha:0,
    beta:0,
    gamma:0,
    delte:0,
    epsilon:0
}; //按需要类型统计占比，用于计算legend宽度

var need = {};//记录当前操作的need
var categoryNeed = {};//记录当前操作的categoryNeed，注意新增need是直接完成

//加载阶段列表：一次加载全部，用于顶部滑动条
var categories = [];
function loadCategories() {
    util.AJAX(app.config.sx_api+"/mod/itemCategory/rest/all-categories", function (res) {
        console.log("got categories.",res);
        categories = res;
        showSwiper();    
    });
}
//显示滑动条
function showSwiper(){
    //装载到页面
    categories.forEach(function(item){
        if(item.id != "1") //排除根节点
            insertCategoryItem(item);
    });
  
    //显示滑动条
    var mySwiper = new Swiper ('.swiper-container', {
        slidesPerView: 7,
    });  
    //调整swiper 风格，使之悬浮显示
    /**
    $(".swiper-container").css("position","fixed");
    $(".swiper-container").css("left","0");
    $(".swiper-container").css("top","0");
    $(".swiper-container").css("z-index","999");
    $(".swiper-container").css("background-color","#fff");
    //$(".swiper-container").css("margin-bottom","3px");
    //**/
  
    //将当前选中条目设为高亮  
    if(categoryId){//有指定Id则直接高亮
        var category = categories.find(item => item.id == categoryId);
        if(category){
            changeCategory(category);
        }else{
            console.log("cannot find category by id.",$(this).data("id"));
        }         
    }else{//否则，默认为第一个
        changeCategory(categories[0]);
    }
  
}

//显示滑动条显示元素：category，包括LOGO及名称
function insertCategoryItem(category){
    //logo
    var logo = "http://www.shouxinjk.net/static/logo/distributor/ilife.png";
    if(category.logo && category.logo.indexOf("http")>-1){
        logo = category.logo;
    }else if(category.logo && category.logo.trim().length>0){
        logo = "http://www.shouxinjk.net/static/logo/category/"+category.logo;
    }
    // 显示HTML
    var html = '';
    html += '<div class="swiper-slide">';
    html += '<div class="person" id="'+category.id+'" data-id="'+category.id+'">';
    var style = category.id==categoryId?'-selected':'';
    html += '<div class="person-img-wrapper"><img class="person-img'+style+'" src="'+logo+'"/></div>';
    html += '<span class="person-name">'+category.name+'</span>';
    html += '</div>';
    html += '</div>';
    $("#categories").append(html);

    //注册事件:点击后切换
    $("#"+category.id).click(function(e){
      console.log("change category.",$(this).data("id"));
      var category = categories.find(item => item.id == $(this).data("id"));
      if(category){
        changeCategory(category);
      }else{
        console.log("cannot find category by id.",$(this).data("id"));
      }
      
    });
}
//切换Category
function changeCategory (category) {
    console.log("change category.",category);
    $("#"+categoryId+" img").removeClass("person-img-selected");
    $("#"+categoryId+" img").addClass("person-img");
    $("#"+category.id+" img").removeClass("person-img");
    $("#"+category.id+" img").addClass("person-img-selected");

    $("#"+categoryId+" span").removeClass("person-name-selected");
    $("#"+categoryId+" span").addClass("person-name");
    $("#"+category.id+" span").removeClass("person-name");
    $("#"+category.id+" span").addClass("person-name-selected");

    categoryId = category.id;
    categoryName = category.name;
    if(category.description && category.description.trim().length>0){
        $("#summaryDiv").css("display","block");
        $("#summary").html(category.description);
    }

    loadCategoryNeeds();//重新加载数据
  } 

//装载需要类型
function loadNeedTypes(){
    util.AJAX(app.config.sx_api+"/sys/dict/rest/byType", function (res) {
        showloading(false);
        console.log("loadItems try to retrive pending items.", res)
        if (res && res.length>0) {//加载类型列表
            res.forEach(function(item){
                needTypes[item.value]=item.label;
                //加入选择器
                var needtypeColor = "color:"+needTypeColor[item.value]+";border:1px solid "+needTypeColor[item.value];
                var needTypeTag = "<div id='needType"+item.value+"' data-value='"+item.value+"' style='line-height:20px;font-size:12px;min-width:60px;font-weight:bold;padding:2px 10px;border-radius:20px;margin:2px;"+needtypeColor+"'>"+item.label+"</div>"
                $("#needTypesDiv").append( needTypeTag );//同步写入候选表单      
                //注册事件
                $("#needType"+item.value).click(function(){
                    console.log("need type changed. ",  $(this).data("value") );
                    needType = $(this).data("value");

                    //高亮
                    Object.keys(needTypes).forEach(function(type){
                        if(type==needType){
                            $("#needType"+type).css("background-color",needTypeColor[type]);
                            $("#needType"+type).css("color","#fff");  
                        }else{
                            $("#needType"+type).css("background-color","#fff");
                            $("#needType"+type).css("color",needTypeColor[type]);  
                        }
                    });
                    /**
                    $("div[id^=needType]").css("background-color","#fff");
                    $("div[id^=needType]").css("color","#000");          
                    $("#needType"+needType).css("background-color","#2a61f1");
                    $("#needType"+needType).css("color","#fff");    
                    //**/    
                });                          
            });         
        }else{//如果没有则提示，
            console.log("cannot load ditc by type: need_type ");           
        }
    }, 
    "GET",
    {type:"need_type"},
    {});
}

//装载CategoryNeed数据
function loadCategoryNeeds(){
    if(!categoryId){
        console.log("categoryId cannot be null.");
        return;
    }
    //根据categoryId获取所有需要列表
    console.log("try to load needs.",categoryId);
    $.ajax({
        url:app.config.sx_api+"/mod/categoryNeed/rest/needs/"+categoryId,
        type:"get",
        //data:JSON.stringify(categoryId),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===got needs===\n",ret);
            if(ret && ret.length>0){
                categoryNeeds = ret;
                var nodes = [];
                if(categoryNeeds && categoryNeeds.length>0){//合并子级指标
                    categoryNeeds.forEach(function(node){
                        nodes.push({
                            name: node.need.name,
                            id: node.need.id,
                            weight: node.weight
                        });
                    });
                }    
                showCategoryNeeds();//显示属性列表供操作       
                showTreemap( nodes );                
            }else{
                showCategoryNeeds();//显示属性列表供操作：需要显示待添加列表
                $("#treemap").empty();//清空已经加载的treemap
                $("#legendDiv").empty();//清空已经加载的legend
            }
        }
    });  
}

//显示属性列表：能够直接发起增、删、改操作。显示时需要结合所有可选属性，以及已添加属性进行。
function showCategoryNeeds(){
    //先清空
    $("#categoryNeedsDiv").empty();
    $("#legendDiv").empty();

    //逐条显示已经添加的属性节点
    if(categoryNeeds && categoryNeeds.length>0){
        categoryNeeds.forEach(function(node){
            //按类型汇总needType权重
            if(!needTypeWeightSum[node.need.type]){
                needTypeWeightSum[node.need.type] = 0;
            }
            needTypeWeightSum[node.need.type] = needTypeWeightSum[node.need.type] + node.weight;
            //显示到界面
            var tagclass = node.weight<0.1?"sxTag0":"measureTag"; //权重较低则灰色显示
            var needtypeColor = "color:#fff;background-color:"+needTypeColor[node.need.type]+";border:1px solid "+needTypeColor[node.need.type];
            var html = '<div class="'+tagclass+'" id="categoryneed'+node.id+'" data-id="'+node.id+'" style="'+needtypeColor+'">';
            html += node.need.name + " "+ node.weight+"%";
            html += '</div>';
            $("#categoryNeedsDiv").append(html);
            //注册点击事件：点击后弹出浮框完成修改或删除
            $("#categoryneed"+node.id).click(function(){ 
                //从列表里取出当前操作的categoryNeed
                var currentCategoryNeedId = $(this).data("id");
                categoryNeed = categoryNeeds.find(item => item.id == currentCategoryNeedId);
                if(categoryNeed){
                    showCategoryNeedInfoForm();
                }else{
                    console.log("no categoryNeed found by id.",currentCategoryNeedId);
                }
            });
        });   

        //计算legend宽度：按照汇总值，分别计算百分比得到
        var sumWeight = 0;
        Object.keys(needTypeWeightSum).forEach(function(type){
            sumWeight += needTypeWeightSum[type];
        });
        console.log("got weight sum.",sumWeight,needTypeWeightSum);
        Object.keys(needTypeWeightSum).forEach(function(type){ //分别计算宽度并显示
            //添加legend显示
            var weight = needTypeWeightSum[type]/sumWeight*100;
            $("#legendDiv").append("<div id='legend"+type+"' style='background-color:"+needTypeColor[type]+";color:#fff;font-size:10px;padding:2px;height:48px;padding:2px;width:"+(weight==0?0.1:weight)+"%;display: table;_position:relative;overflow:hidden;'><div style='vertical-align: middle;display: table-cell;_position: absolute;_top: 50%;'><div style='_position: relative;_top: -50%;'>"+needTypes[type] + " "+weight.toFixed(1)+"%</div></div></div>");
        });        
    }

    //查询得到待添加需要列表，注意类型为Need
    $.ajax({
        url:app.config.sx_api+"/mod/categoryNeed/rest/pending-needs/"+categoryId,
        type:"get",
        //data:JSON.stringify({}),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===got pending categorys===\n",ret);
            if(ret && ret.length>0 && $("#createNeedBtn").length==0){  //避免重复添加
                //逐条添加，注意是need节点
                ret.forEach(function(node){
                    var needtypeColor = "color:"+needTypeColor[node.type]+";border:1px solid "+needTypeColor[node.type];
                    var html = '<div class="sxTag0" id="need'+node.id+'" data-id="'+node.id+'" data-name="'+node.name+'" style="'+needtypeColor+'">';
                    html += node.name;
                    html += '</div>';
                    $("#categoryNeedsDiv").append(html);
                    //注册点击事件：点击后弹出浮框完成修改或删除
                    $("#need"+node.id).click(function(){ 
                        //新增categoryNeed
                        categoryNeed = {
                            name: $(this).data("name"),
                            category: {id: categoryId}, //设置当前category
                            need: {id: $(this).data("id")} //直接将当前选中属性作为categoryNeed 的关联属性
                        };
                        showCategoryNeedInfoForm();
                    });
                });                
            }else{
              console.log("no more pending needs.");   
            }

            //增加创建按钮:避免重复添加
            if($("#createNeedBtn").length==0){ 
                //添加新增need并注册事件
                $("#categoryNeedsDiv").append('<div class="sxTagNew" id="createNeedBtn" style="background-color:#514c49;border:1px solid #514c49;color:#fff;">+ 添加需要</div>');
                //注册点击事件：点击后弹出浮框完成修改或删除
                $("#createNeedBtn").click(function(){ 
                    //设置空白category
                    categoryNeed = {}
                    showNeedInfoForm();
                });
            }

        }
    });        

}
//操作按钮：显示categoryNeed修改表单
function showCategoryNeedInfoForm(){
    console.log("show categoryNeed form.",categoryNeed);  
    //显示数据填报表单
    $.blockUI({ message: $('#categoryneedform'),
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
    //设置默认值：对于有选定categoryNeed的情况
    if(categoryNeed && categoryNeed.id && categoryNeed.id.trim().length>0){ //已经关联的属性
        $("#categoryNeedName2").val("需要："+categoryNeed.need.name);
        $("#categoryNeedWeight2").val(categoryNeed.weight);
    }else if(categoryNeed && categoryNeed.name && categoryNeed.name.trim().length>0){ //已存在但未关联属性
        $("#categoryNeedName2").val("需要："+categoryNeed.name);
    }else{//新建属性
        $("#categoryNeedName2").val("");
        $("#categoryNeedWeight2").val("");        
    }
    //判定是否显示删除按钮：仅对于已经存在的指标显示删除按钮
    if(categoryNeed && categoryNeed.id && categoryNeed.id.trim().length>0){
        $("#btnDeleteCategoryNeed").css("display","block");
    }else{
        $("#btnDeleteCategoryNeed").css("display","none");
    }
    $("#btnCancelCategoryNeed").click(function(){      
        $.unblockUI(); //直接取消即可
    });
    $("#btnDeleteCategoryNeed").click(function(){//完成后需要刷新数据，包括treemap、指标列表、属性列表
        console.log("try to delete item.");
        deleteCategoryNeedInfo(categoryNeed);
    });    
    $("#btnSaveCategoryNeed").click(function(){//完成后需要刷新数据，包括treemap、指标列表、属性列表
        if( !$("#categoryNeedWeight2").val() || $("#categoryNeedWeight2").val().trim().length ==0 ){
            $("#categoryNeedWeight2").val(categoryNeed.weight);
            siiimpleToast.message('数据占比为必填~~',{
              position: 'bottom|center'
            });                 
        }else{
            console.log("try to save new item.");
            categoryNeed.weight = $("#categoryNeedWeight2").val();//仅需设置权重即可，needId及categoryId已提前完成设置
            saveCategoryNeedInfo(categoryNeed);
        }
    });
}
//保存category信息：完成后关闭浮框，并且刷新数据
function saveCategoryNeedInfo(categoryNeed){
    console.log("try to save categoryNeed info.",categoryNeed,JSON.stringify(categoryNeed));
    $.ajax({
        url:app.config.sx_api+"/mod/categoryNeed/rest/category-need",
        type:"post",
        data:JSON.stringify(categoryNeed),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===save categoryNeed done===\n",ret);
            if(ret.success){ 
                //取消浮框，并刷新界面
                $.unblockUI(); //直接取消即可
                loadDimensionInfo();
            }else{
              siiimpleToast.message('啊哦，出错了~~',{
                      position: 'bottom|center'
                    });    
            }
        }
    });
}
//删除category信息：完成后关闭浮框，并且刷新数据
function deleteCategoryNeedInfo(categoryNeed){
    console.log("try to delete categoryNeed info.",categoryNeed);
    $.ajax({
        url:app.config.sx_api+"/mod/categoryNeed/rest/category-need",
        type:"put",//DELETE方法遇到CORS问题，采用PUT
        data:JSON.stringify(categoryNeed),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===delete categoryNeed done===\n",ret);
            if(ret.success){ 
                //取消浮框，并刷新界面
                $.unblockUI(); //直接取消即可
                loadCategoryNeeds();
            }else{
              siiimpleToast.message('啊哦，出错了~~',{
                      position: 'bottom|center'
                    });    
            }
        }
    });
}
//操作按钮：显示新增need表单：注意need表单仅提供新增，不提供修改或删除操作
function showNeedInfoForm(){
    console.log("show need form.");  

    //显示数据填报表单
    $.blockUI({ message: $('#needform'),
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
    $("#btnCancelNeed").click(function(){      
        $.unblockUI(); //直接取消即可
    });   
    $("#btnSaveNeed").click(function(){//保存属性，并且直接保存categoryNeed关联设置，完成后刷新数据
        if( !$("#needWeight2").val() || $("#needWeight2").val().trim().length ==0 ){
            siiimpleToast.message('数据占比为必填~~',{
              position: 'bottom|center'
            });                 
        }else if( !needType ){
            siiimpleToast.message('需要选择类型~~',{
              position: 'bottom|center'
            });                 
        }else if( !$("#needName2").val() || $("#needName2").val().trim().length ==0 ){
            siiimpleToast.message('字段名称为必填~~',{
              position: 'bottom|center'
            });                 
        }else{
            console.log("try to save new need item.");
            saveNeedInfo(
                $("#needName2").val().trim(),
                $("#needAlias2").val().trim(),
                $("#needWeight2").val().trim()
            );
        }
    });
}
//保存need信息：完成后需要继续提交建立categoryNeed，并且关闭浮框
function saveNeedInfo(name,alias,weight){
    var need = { //构建空白need信息，全部采用默认值填写
        name: name,
        displayName: alias,
        type: needType
    };
    console.log("try to save need info.",need);
    $.ajax({
        url:app.config.sx_api+"/mod/motivation/rest/need",
        type:"post",
        data:JSON.stringify(need),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===save need done===\n",ret);
            if(ret.success && ret.data){ 
                //先取消浮框
                //$.unblockUI(); //直接取消即可
                //建立categoryNeed
                saveCategoryNeedInfo({
                    category:{id: categoryId},
                    need:{id: ret.data.id},
                    weight: weight
                });
            }else{
              siiimpleToast.message('啊哦，出错了~~',{
                      position: 'bottom|center'
                    });    
            }
        }
    });
}
//保存categoryNeed信息：完成后关闭浮框，并且刷新数据
function saveCategoryNeedInfo(categoryNeed){
    console.log("try to save categoryNeed info.",categoryNeed,JSON.stringify(categoryNeed));
    $.ajax({
        url:app.config.sx_api+"/mod/categoryNeed/rest/category-need",
        type:"post",
        data:JSON.stringify(categoryNeed),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===save categoryNeed done===\n",ret);
            if(ret.success){ 
                //取消浮框，并刷新界面
                $.unblockUI(); //直接取消即可
                loadCategoryNeeds();
            }else{
              siiimpleToast.message('啊哦，出错了~~',{
                      position: 'bottom|center'
                    });    
            }
        }
    });
}

//显示treemap图
function showTreemap(dimtree){
    console.log("start show treemap.",dimtree);
    //显示标题：
    $("#treemapTitle").css("display","block");
    //显示treemap图表    
    Treemap("#treemap", dimtree, {
      path: d => d.name.replace(/\./g, "/"), // e.g., "flare/animate/Easing"
      value: d => d?d.weight:1, //d?.weight, // size of each node (file); null for internal nodes (folders)
      group: d => d.name.split(".")[0], // e.g., "animate" in "flare.animate.Easing"; for color
      label: (d, n) => [...d.name.split(".").pop().split(/(?=[A-Z][a-z])/g), n.value.toLocaleString("en")].join("\n"),
      title: (d, n) => `${d.name}\n${n.value.toLocaleString("en")}`, // text to show on hover
      //link: (d, n) => `${d.href}`,//`https://www.biglistoflittlethings.com/ilife-web-wx/expert/category.html?categoryId=${d.categoryId}&id=${d.id}`,
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
        //console.log("image uri.",dataURLtoFile(uri,"category.png"));
        //将图片提交到服务器端。保存文件文件key为：need-scheme
        uploadPngFile(uri, "treemap.png", "need-scheme");//文件上传后将在stuff.media下增加{need-scheme:imagepath}键值对
    }); 
    //**/ 
}


//加载当前修改的connection
function loadConnection(){
    var query={
            collection: "connections", 
            example: { 
                _from:"user_users/"+userInfo._key,//发起端为当前用户
                _to:"user_users/"+currentPersonId//目的端为修改用户
            },
            limit:1
        };   
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 
    util.AJAX(app.config.data_api+"/_api/simple/by-example", function (res) {
        //showloading(false);
        console.log("User::Settings::loadConnection try to retrive user connections.", res);
        if(res && res.count==0){//如果没有则表示有问题哦
            console.log("something wrong. we cannot get user-user connections.");
            $("#relationship").val("我关心的TA");//设置默认关系名称
        }else{//否则更新关系名称
            var hits = res.result;
            currentConnection = hits[0];
            $("#relationship").val(currentConnection.name);//设置默认关系名称
        }
    }, "PUT",query,header);
}

//加载用户关联的Persona
function loadPersona(categoryId){
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 
    util.AJAX(app.config.data_api+"/_api/document/category_categorys/"+categoryId, function (res) {
        console.log("Broker::My Loaded category by id.", res)
        if(res){
            currentPersona = res;
            currentPerson = {//直接引用category属性作为当前用户设置
              ...res
            };
            delete  currentPerson._key;
            delete  currentPerson._id;
            delete  currentPerson._rev;
            delete  currentPerson.broker;
            delete  currentPerson.image;
            delete  currentPerson.name;
            currentPerson.category = res;//设置当前用户的category信息
            if(res.image)
                currentPerson.avatarUrl = res.image;//设置默认头像
            if(res.name)
                currentPerson.nickName = res.name+"人设";//默认设置名称为画像名称
            currentPerson.status = "pending";//设置为待分析用户
            showPerson(currentPerson);
        }
    }, "GET",{},header);
}

//将默认信息填写到表单
function showPerson(person){
    $("#nickName").val(person.nickName);
    //如果当前修改的用户和登录用户不同，则显示关系字段，否则隐藏
    if(currentPerson._key==userInfo._key){
        $("#relationship-wrapper").css("display","none");
    }else{
        $("#relationship-wrapper").css("display","block");
    }
    //如果用户是画像则显示分享二维码按钮，否则隐藏
    if(person.openId){
        $("#qrcodeBtn").css("display","none");
        $("br").css("display","none");
    }    
    //$("#personTags").val(person.tags?person.tags.join(" "):"");
    //加载标签列表供选择
    //loadTags(); 

    // 表示加载结束
    loading = false;
}

function goRecommend(){
    window.location.href = "index.html?type="+(currentPerson.openId?"person":"category")+"&id="+currentPerson._key;
}
function goActionHistory(){
    window.location.href = "feeds.html?type="+(currentPerson.openId?"person":"category")+"&id="+currentPerson._key;
}

//修改用户信息
function updatePerson(){
    currentPerson.nickName = $("#nickName").val().trim().length>0?$("#nickName").val().trim():currentPersona.name;

    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 

    //创建或更新用户
    if(currentPerson._key && currentPerson._key.trim().length>0){//如果有_key则表示用户存在，直接更新
        console.log("update existing user.",currentPerson);
        util.AJAX(app.config.data_api+"/_api/document/user_users/"+currentPerson._key, function (res) {
            console.log("User::Setting updated.", res)
            if(from=="connection"){
                //window.location.href = "connection.html";//跳转到关心的人列表
                var conn={
                    name:$("#relationship").val()?$("#relationship").val():"我关心的TA"
                };
                console.log("try to update connections.",conn);
                util.AJAX(app.config.data_api+"/_api/document/connections/"+currentConnection._key, function (res) {
                    console.log("User::Connection updated.", res)
                    window.location.href = "connection.html";//跳转到关心的人列表
                }, "PATCH",conn,header); 
            }else{
                window.location.href = "user.html";//跳转到设置页面
            }
        }, "PATCH",currentPerson,header);
    }else{//否则创建后更新
        console.log("create new user.",currentPerson);
        var key = md5(currentPerson.category._key+userInfo._key+new Date().getTime(),16);//构建一个user._key。注意用短md5，构成差异，并且避免微信 二维码 scene_str 总长64位限制
        util.AJAX(app.config.data_api+"/user/users/"+key, function (res) {
            console.log("User::Setting user created.", res)
            currentPerson = res;
            //建立与当前登录用户的关联
            if(from=="connection"){
                //新建connection后跳转回到列表页面
                var conn={
                    _from:"user_users/"+userInfo._key,
                    _to:"user_users/"+currentPerson._key,
                    name:$("#relationship").val()?$("#relationship").val():"我关心的TA"
                };
                console.log("try to create connections.",conn);
                util.AJAX(app.config.data_api+"/_api/document/connections", function (res) {
                    console.log("User::Connection created.", res)
                    window.location.href = "connection.html";//跳转到关心的人列表
                }, "POST",conn,header);                 
            }else{//不可能走到这里，自己设置时是已经有了用户的，仅对于新增关心的人才会进来
                console.log("how could it be?");
            }
        }, "POST",currentPerson,header);
    }

    //将用户信息推送到kafka
    util.updatePersonNotify(currentPerson);
}

//删除关心的人。注意：仅删除关联
function deletePerson(){
    currentPerson.nickName = $("#nickName").val().trim().length>0?$("#nickName").val().trim():currentPersona.name;

    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 

    console.log("try to remove connections.",currentConnection);
    util.AJAX(app.config.data_api+"/_api/document/connections/"+currentConnection._key, function (res) {
        console.log("User::Connection removed.", res)
        if(!currentPerson.openId){//如果是非注册用户，则直接删除
            console.log("try to remove unregistered user.",currentPerson);
            util.AJAX(app.config.data_api+"/_api/document/user_users/"+currentPerson._key, function (res) {
                console.log("User::Setting updated.", res)
                window.location.href = "connection.html";//跳转到关心的人列表
            }, "DELETE",{},header);
        }else{
            window.location.href = "connection.html";//跳转到关心的人列表
        }
    }, "DELETE",{},header); 
}

//加载预定义用户标签：仅加载用户标注类标签
function loadTags(){
   var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 
    console.log("try to load user tags.");
    util.AJAX(app.config.sx_api+"/mod/userTag/rest/tags?types=user-setting", function (res) {
        console.log("Broker::My Loaded category tags.", res)
        if(res){
            showTags(res);//直接开始显示
        }
    }, "GET",{},header);    
}

//显示预定义标签。采用动态显示的方式
var userTagTypes = [];//存放类别名称
var userTags = [];//按照分类存放分类下的tags
function showTags(tags){
    //首先将所有tag按照类别放入二维数组
    for(var i=0;i<tags.length;i++){
        var tag = tags[i];
        var tagType = tag.userTagCategory.name;
        if(userTagTypes.indexOf(tagType)<0){
            userTagTypes.push(tagType);
            userTags[tagType] = [];
        }
        var subTags = userTags[tagType];
        subTags.push(tag);
        userTags[tagType] = subTags;
    }
    //然后按照二维数组组织HTML显示
    var html = "";
    for(var i=0;i<userTagTypes.length;i++){
        var userTagByCategory = userTagTypes[i];
        //添加标签分类及分割线
        $("#user-tags-div").append("<div class='user-tag-wrapper-separator'></div>");
        $("#user-tags-div").append("<div class='user-tag-wrapper' id='user-tag-wrapper-"+userTagByCategory+"'></div>");
        //添加分类文字
        $("#user-tag-wrapper-"+userTagByCategory).append('<div class="user-tag-category">'+userTagByCategory+'</div>');
        //添加具体标签
        var taglist = userTags[userTagByCategory];
        $("#user-tag-wrapper-"+userTagByCategory).append('<div class="user-tag-list" id="user-tag-list-'+userTagByCategory+'"></div>');
        for(var j=0;j<taglist.length;j++){
            var tag = taglist[j];

            //创建动态判定脚本，并检查是否已经选中
            var myScript= document.createElement("script");
            myScript.type = "text/javascript";
            myScript.appendChild(document.createTextNode('function checkTag'+tag.id+'(doc){console.log("try to eval tag expr.",doc); return '+tag.ruleOfJudgment+';}'));
            document.body.appendChild(myScript); 

            //组织tag HTML            
            $("#user-tag-list-"+userTagByCategory).append('<div class="user-tag" id="tag'+tag.userTagCategory.id+'-'+tag.id+'" data-tagId="'+tag.id+'" data-name="'+tag.name+'" data-rule=\''+tag.ruleOfJudgment+'\' data-categoryId="'+tag.userTagCategory.id+'" data-type="'+tag.userNeed.type+'" data-property="'+tag.userNeed.property+'" data-isExclusive="'+tag.userTagCategory.isExclusive+'" data-expr=\''+tag.expression+'\'>'+tag.name+'</div>');
            //注册点击事件
            $("#tag"+tag.userTagCategory.id+'-'+tag.id).click(function(e){
                changeTag(e);
            }); 
    
            //检查tag状态
            checkTagStatus({
                tagId:tag.id,
                name:tag.name,
                type:tag.userNeed.type,
                property:tag.userNeed.property,  
                rule:tag.ruleOfJudgment,
                expr:tag.expression,  
                categoryId:tag.userTagCategory.id,                              
                isExclusive:tag.userTagCategory.isExclusive
            });       
        }
    }
}

//tag点选响应事件
function changeTag(e){
    console.log("tag changed.",e);
    var data = {};
    if(e.currentTarget.dataset.type=="script"){//通过脚本直接更新
        try{
            data = JSON.parse(e.currentTarget.dataset.expr); 
        }catch(err){
            console.log("parse expression error.",e.currentTarget.dataset.expr);
        }
    }else if(e.currentTarget.dataset.type=="array"){//这是一个数组，则要单独做一些处理
        var tag = e.currentTarget.dataset.name;
        var array = currentPersona[e.currentTarget.dataset.property];
        if(!array){
            array=[];
        }
        if(array.indexOf(tag)>=0){//如果存在则删除
            var str = array.join(" ");
            str = str.replace(tag,"").replace(/\s+/g," ");
            array = str.split(" ");
        }else{
            array.push(tag)
        }
        var uniqueArray = [...new Set(array)];//排重
        var newArray = [];
        for(var k=0;k<uniqueArray.length;k++){
            if(uniqueArray[k]&&uniqueArray[k].trim().length>0){
                newArray.push(uniqueArray[k].trim());
            }
        }
        data[e.currentTarget.dataset.property]=newArray;
        currentPersona[e.currentTarget.dataset.property]=newArray;
    }else{
        console.log("what the fuck. I dont know the type.[type]"+e.currentTarget.dataset.type);
    }

    //修改currentPerson信息，直接merge
    currentPerson = {
      ...currentPerson,
      ...data
    };

    console.log("currentPerson changed by tag.",currentPerson);   
    changeTagDisplay({
        tagId:e.currentTarget.dataset.tagid,
        name:e.currentTarget.dataset.name,
        type:e.currentTarget.dataset.type,
        property:e.currentTarget.dataset.property,
        categoryId:e.currentTarget.dataset.categoryid,
        isExclusive:e.currentTarget.dataset.isexclusive
    });
}

//修改tag显示风格
function changeTagDisplay(tagInfo){
    //console.log("try to change tag style.",tagInfo);
    if(tagInfo.isExclusive=="1" || tagInfo.isExclusive==1){    //如果是单选，则先把所有已选中的干掉，然后把选中的加上高亮
        //把同一类标签风格都改为取消状态
        console.log("change exclusive tag.",tagInfo)
        $("div[id^='tag"+tagInfo.categoryId+"']").each(function(index, element) {
             $(this).removeClass("user-tag-selected");
             $(this).addClass("user-tag");
        });   
        //高亮显示当前选中的标签 
        $("#"+tagInfo.categoryId+'-'+tagInfo.tagId).removeClass("user-tag");
        $("#tag"+tagInfo.categoryId+'-'+tagInfo.tagId).addClass("user-tag-selected");        
    }else{//对于多选，如果当前值在列表内则加上高亮，如果不在则去掉高亮
        console.log("\n\nchange non-exclusive tag.",tagInfo)
        if(currentPerson[tagInfo.property] && currentPerson[tagInfo.property].indexOf(tagInfo.name)>=0){
            $("#tag"+tagInfo.categoryId+'-'+tagInfo.tagId).removeClass("user-tag");
            $("#tag"+tagInfo.categoryId+'-'+tagInfo.tagId).addClass("user-tag-selected");             
        }else{
            $("#tag"+tagInfo.categoryId+'-'+tagInfo.tagId).removeClass("user-tag-selected");
            $("#tag"+tagInfo.categoryId+'-'+tagInfo.tagId).addClass("user-tag");             
        }
    }
}

//检查tag是否选中。仅用于初次加载时
function checkTagStatus(tagInfo){
    //console.log("try to check tag status.",tagInfo);
    var result = false;
    eval("result=checkTag"+tagInfo.tagId+"(currentPerson);");
    console.log("check tag result.",result,tagInfo,currentPerson);
    if( result ){
        changeTagDisplay(tagInfo);
    }
}

//load person
function loadPerson(personId) {
    console.log("try to load person info.",personId);
    util.AJAX(app.config.data_api+"/user/users/"+personId, function (res) {
        console.log("load person info.",personId,res);
        //userInfo = res;
        currentPerson = res;
        //检查是否有persona设置，如果没有则跳转到persona选择界面
        if((res.persona && res.persona._key) || !res.openId){//如果有category则显示表单。注意：对于通过画像生成虚拟用户则直接显示表单，通过有无openId判断
            insertPerson(userInfo);//TODO:当前直接显示默认信息，需要改进为显示broker信息，包括等级、个性化logo等
            showPerson(currentPerson);//显示设置的用户表单
            loadBrokerByOpenid(userInfo._key);//根据当前登录用户openid加载broker信息
        }else{//没有category则提示先选择一个category
            window.location.href = "user-choosepersona.html?id="+personId+"&refer=user";//refer=user表示设置后返回到user界面
        }
    });
}

//更新Broker
function updateBroker(broker) {
    console.log("try to update broker.[broker]",broker);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/"+broker.id, function (res) {
        console.log("update broker successfully.",res);
    },"PUT",broker,{ "Content-Type":"application/json" });
}

//根据openid查询加载broker
function loadBrokerByOpenid(openid) {
    console.log("try to load broker info by openid.[openid]",openid);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokerByOpenid/"+openid, function (res) {
        console.log("load broker info.",openid,res);
        if (res.status) {
            insertBroker(res.data);//显示达人信息
        }
    });
}

//显示没有更多内容
function shownomore(flag){
  if(flag){
    $("#footer").toggleClass("footer-hide",false);
    $("#footer").toggleClass("footer-show",true);
  }else{
    $("#footer").toggleClass("footer-hide",true);
    $("#footer").toggleClass("footer-show",false);
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

function changeActionType (e) {
    console.log("now try to change action type.",e);
    //首先清除原来高亮状态
    if(currentActionType.trim().length>0){
        $("#"+currentActionType+" img").attr("src","images/"+currentActionType+".png"); 
        $("#"+currentActionType+" div").removeClass("actiontype-selected");
        $("#"+currentActionType+" div").addClass("actiontype");  
    }  
    //更改并高亮显示
    currentActionType = e.currentTarget.id;
    tagging = e.currentTarget.dataset.tagging;
    if (app.globalData.isDebug) console.log("User::ChangeActionType change action type.",currentActionType,tagging);
    if(currentActionType.trim().length>0){
        $("#"+currentActionType+" img").attr("src","images/"+currentActionType+"-selected.png"); 
        $("#"+currentActionType+" div").removeClass("actiontype");
        $("#"+currentActionType+" div").addClass("actiontype-selected");  
    } 

    //跳转到相应页面
    window.location.href = currentActionType+".html";
}


//修改category的tags：每次修改后均做更新，且仅更新tags
function updatePersonaTags(){
    var data={
        tags:currentPersona.tags//在发生操作后直接修改
    }
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 
    util.AJAX(app.config.data_api+"/_api/document/category_categorys/"+currentPersona._key, function (res) {
        console.log("Broker::My Persona tags updated.", res)
    }, "PATCH",data,header);
}


//show editable tags
function showMoreTags(){
    var moreTags = currentPerson.tags?currentPerson.tags:[];
    currentPerson.tags = moreTags;
    for(var i=0;i<moreTags.length;i++){
        $('#moreTags').append("<li>"+moreTags[i]+"</li>");
    }
    var eventTags = $('#moreTags');

    var addEvent = function(text) {
        console.log(text,currentPerson);
        //$('#events_container').append(text + '<br>');
    };

    eventTags.tagit({
        availableTags: moreTags,//TODO: 可以获取所有标签用于自动补全
        //**
        beforeTagAdded: function(evt, ui) {
            if (!ui.duringInitialization) {
                addEvent('beforeTagAdded: ' + eventTags.tagit('tagLabel', ui.tag));
            }
        },//**/
        afterTagAdded: function(evt, ui) {
            if (!ui.duringInitialization) {
                currentPerson.tags.push(eventTags.tagit('tagLabel', ui.tag));
                addEvent('afterTagAdded: ' + eventTags.tagit('tagLabel', ui.tag));
            }
        },
        //**
        beforeTagRemoved: function(evt, ui) {
            addEvent('beforeTagRemoved: ' + eventTags.tagit('tagLabel', ui.tag));
        },//**/
        afterTagRemoved: function(evt, ui) {
            var tags = currentPerson.tags.join(" ").replace(eventTags.tagit('tagLabel', ui.tag),"");
            currentPerson.tags = tags.split(" ");
            addEvent('afterTagRemoved: ' + eventTags.tagit('tagLabel', ui.tag));
        },
        /**
        onTagClicked: function(evt, ui) {
            addEvent('onTagClicked: ' + eventTags.tagit('tagLabel', ui.tag));
        },//**/
        onTagExists: function(evt, ui) {
            addEvent('onTagExists: ' + eventTags.tagit('tagLabel', ui.existingTag));
        }
    });    
}


