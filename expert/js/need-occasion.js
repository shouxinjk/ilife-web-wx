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
   
    if(args["occasionId"]){
        occasionId = args["occasionId"]; 
    }
    if(args["occasionName"]){
        occasionName = args["occasionName"]; 
        $("#treemapTitle").prepend("<span style='padding:0 2px;/*color:#007bff;*/'>"+occasionName+"</span>");
    }    

    $("body").css("background-color","#fff");//更改body背景为白色

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });      
    //loadPerson(currentPersonId);//加载需要修改的用户信息

    //注册事件：直接进入首页，通过切换画像得到
    $("#vailidateBtn").click(function(e){
        window.location.href="../index.html?occasionId="+occasionId;
    });

    //加载需要类型
    loadNeedTypes();

    //加载所有事件列表：注意是加载全部事件
    loadOccasions();//加载后将自动高亮，并加载需要数据

    //加载维度定义数据
    //loadOccasionNeeds();

    //注册事件：设置已存在需要
    $("#btnCancelOccasionNeed").click(function(){      
        $.unblockUI(); //直接取消即可
    });
    $("#btnDeleteOccasionNeed").click(function(){//完成后需要刷新数据，包括treemap、指标列表、属性列表
        console.log("try to delete item.");
        deleteOccasionNeedInfo(occasionNeed);
    });    
    $("#btnSaveOccasionNeed").click(function(){//完成后需要刷新数据，包括treemap、指标列表、属性列表
        if( !$("#occasionNeedWeight2").val() || $("#occasionNeedWeight2").val().trim().length ==0 ){
            $("#occasionNeedWeight2").val(occasionNeed.weight);
            siiimpleToast.message('请点选星星设置权重~~',{
              position: 'bottom|center'
            });                 
        }else{
            console.log("try to save new item.");
            occasionNeed.weight = $("#occasionNeedWeight2").val();//仅需设置权重即可，needId及occasionId已提前完成设置
            saveOccasionNeedInfo(occasionNeed);
        }
    });

    //注册事件：新增need
    $("#btnCancelNeed").click(function(){      
        $.unblockUI(); //直接取消即可
    });   
    $("#btnSaveNeed").click(function(){//保存属性，并且直接保存occasionNeed关联设置，完成后刷新数据
        if( !$("#needName2").val() || $("#needName2").val().trim().length ==0 ){
            siiimpleToast.message('名称为必填~~',{
              position: 'bottom|center'
            });                 
        }else if( !needType ){
            siiimpleToast.message('需要选择类型~~',{
              position: 'bottom|center'
            });                 
        }else if( !$("#needWeight2").val() || $("#needWeight2").val().trim().length ==0 ){
            siiimpleToast.message('请点选星星设置权重~~',{
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

    //打分：新增需求设置权重
    $("#needWeightStars").starRating({//显示为starRating
        totalStars: 10,
        starSize:20,
        useFullStars:false,//能够显示半星
        disableAfterRate: false, //打分后可以继续修改
        starShape: 'rounded',
        //useGradient:true,
        //starGradient:{start: '#FEF7CD', end: '#FF9511'},
        //emptyColor: "lightgrey",
        //initialRating: personaNeed.weight/2,//注意：评分是0-1,直接转换。初始打分置空，等待标注
        ratedColors:['#dc143c', '#ff4500', '#ff6347', '#9acd32','#32cd32'],
        callback: function(currentRating, el){
            //获取当前打分并设置为personaNeedWeight2
            $("#needWeight2").val(currentRating);//直接用打分值
        }
    }); 
    //打分：修改已添加指标权重
    $("#occasionNeedWeightStars").starRating({//显示为starRating
        totalStars: 10,
        starSize:20,
        useFullStars:false,//能够显示半星
        disableAfterRate: false, //打分后可以继续修改
        starShape: 'rounded',
        //useGradient:true,
        //starGradient:{start: '#FEF7CD', end: '#FF9511'},   
        //emptyColor: "lightgrey",     
        //initialRating: personaNeed.weight,//注意：评分是0-1,直接转换。初始打分置空，等待标注
        ratedColors:['#dc143c', '#ff4500', '#ff6347', '#9acd32','#32cd32'],
        callback: function(currentRating, el){
            //获取当前打分并设置为personaNeedWeight2
            $("#occasionNeedWeight2").val(currentRating);//直接用打分值
        }
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

var occasionId = null;
var occasionName = null;
var occasionNeeds = [];//关联的need列表
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
var occasionNeed = {};//记录当前操作的occasionNeed，注意新增need是直接完成

//加载阶段列表：一次加载全部，用于顶部滑动条
var occasions = [];
function loadOccasions() {
    util.AJAX(app.config.sx_api+"/mod/occasion/rest/all-occasions", function (res) {
        console.log("got occasions.",res);
        occasions = res;
        showSwiper();    
    });
}
//显示滑动条
function showSwiper(){
    //装载到页面
    occasions.forEach(function(item){
        if(item.id != "1") //排除根节点
            insertOccasionItem(item);
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
    if(occasionId){//有指定Id则直接高亮
        var occasion = occasions.find(item => item.id == occasionId);
        if(occasion){
            changeOccasion(occasion);
        }else{
            console.log("cannot find occasion by id.",$(this).data("id"));
        }         
    }else{//否则，默认为第一个
        changeOccasion(occasions[0]);
    }
  
}

//显示滑动条显示元素：occasion，包括LOGO及名称
function insertOccasionItem(occasion){
    //logo
    var logo = "http://www.shouxinjk.net/static/logo/distributor/ilife.png";
    if(occasion.logo && occasion.logo.indexOf("http")>-1){
        logo = occasion.logo;
    }else if(occasion.logo && occasion.logo.trim().length>0){
        logo = "../images/occasion/"+occasion.logo;
    }
    // 显示HTML
    var html = '';
    html += '<div class="swiper-slide">';
    html += '<div class="person" id="'+occasion.id+'" data-id="'+occasion.id+'">';
    var style = occasion.id==occasionId?'-selected':'';
    html += '<div class="person-img-wrapper"><img class="person-img'+style+'" src="'+logo+'"/></div>';
    html += '<span class="person-name">'+occasion.name+'</span>';
    html += '</div>';
    html += '</div>';
    $("#occasions").append(html);

    //注册事件:点击后切换
    $("#"+occasion.id).click(function(e){
      console.log("change occasion.",$(this).data("id"));
      var occasion = occasions.find(item => item.id == $(this).data("id"));
      if(occasion){
        changeOccasion(occasion);
      }else{
        console.log("cannot find occasion by id.",$(this).data("id"));
      }
      
    });
}
//切换Occasion
function changeOccasion (occasion) {
    console.log("change occasion.",occasion);
    $("#"+occasionId+" img").removeClass("person-img-selected");
    $("#"+occasionId+" img").addClass("person-img");
    $("#"+occasion.id+" img").removeClass("person-img");
    $("#"+occasion.id+" img").addClass("person-img-selected");

    $("#"+occasionId+" span").removeClass("person-name-selected");
    $("#"+occasionId+" span").addClass("person-name");
    $("#"+occasion.id+" span").removeClass("person-name");
    $("#"+occasion.id+" span").addClass("person-name-selected");

    occasionId = occasion.id;
    occasionName = occasion.name;

    $("#summaryDiv").css("display","block");
    $("#summary").html(occasion.name+" "+(occasion.occasionCategory?occasion.occasionCategory.name:"")+" "+occasion.exprTrigger);

    $("#treemapTitle").empty();
    $("#treemapTitle").append("<span style='padding:0 2px;/*color:#007bff;*/'>"+occasionName+" 需要满足</span>");

    loadOccasionNeeds();//重新加载数据
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
                var needTypeTag = "<div id='needType"+item.value+"' data-value='"+item.value+"' data-type='"+item.value+"' style='line-height:20px;font-size:12px;min-width:60px;font-weight:bold;padding:2px 10px;border-radius:20px;margin:2px;"+needtypeColor+"'>"+item.label+"</div>"
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

//装载OccasionNeed数据
function loadOccasionNeeds(){
    if(!occasionId){
        console.log("occasionId cannot be null.");
        return;
    }
    //根据occasionId获取所有需要列表
    console.log("try to load needs.",occasionId);
    $.ajax({
        url:app.config.sx_api+"/mod/occasionNeed/rest/needs/"+occasionId,
        type:"get",
        //data:JSON.stringify(occasionId),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===got needs===\n",ret);
            if(ret && ret.length>0){
                occasionNeeds = ret;
                var nodes = [];
                if(occasionNeeds && occasionNeeds.length>0){//合并子级指标
                    occasionNeeds.forEach(function(node){
                        nodes.push({
                            name: node.need.name,
                            id: node.need.id,
                            weight: node.weight
                        });
                    });
                }    
                showOccasionNeeds();//显示属性列表供操作       
                showTreemap( nodes );                
            }else{
                showOccasionNeeds();//显示属性列表供操作：需要显示待添加列表
                $("#treemap").empty();//清空已经加载的treemap
                $("#legendDiv").empty();//清空已经加载的legend
            }
        }
    });  
}

//显示属性列表：能够直接发起增、删、改操作。显示时需要结合所有可选属性，以及已添加属性进行。
function showOccasionNeeds(){
    //先清空
    $("#legendDiv").empty();
    $("div[id^=occasionNeedsDiv]").empty();//清空已经加载的need列表

    //逐条显示已经添加的属性节点
    if(occasionNeeds && occasionNeeds.length>0){
        occasionNeeds.forEach(function(node){
            //按类型汇总needType权重
            if(!needTypeWeightSum[node.need.type]){
                needTypeWeightSum[node.need.type] = 0;
            }
            needTypeWeightSum[node.need.type] = needTypeWeightSum[node.need.type] + node.weight;
            //显示到界面
            var needtypeColor = "color:#fff;background-color:"+(needTypeColor[node.need.type]?needTypeColor[node.need.type]:"grey")+";border:1px solid "+(needTypeColor[node.need.type]?needTypeColor[node.need.type]:"grey");
            var html = '<div class="sxTag0" id="occasionneed'+node.id+'" data-id="'+node.id+'" style="'+needtypeColor+'">';
            html += node.need.name + " "+ node.weight+"/10";
            html += '</div>';
            if($("#occasionneed"+node.id).length==0){ //排重
                $("#occasionNeedsDiv"+node.need.type).append(html);
                //注册点击事件：点击后弹出浮框完成修改或删除
                $("#occasionneed"+node.id).click(function(){ 
                    //从列表里取出当前操作的occasionNeed
                    var currentOccasionNeedId = $(this).data("id");
                    occasionNeed = occasionNeeds.find(item => item.id == currentOccasionNeedId);
                    if(occasionNeed){
                        showOccasionNeedInfoForm();
                    }else{
                        console.log("no occasionNeed found by id.",currentOccasionNeedId);
                    }
                });
            }
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
            if(weight>0)
                $("#legendDiv").append("<div id='legend"+type+"' style='background-color:"+needTypeColor[type]+";color:#fff;font-size:10px;font-weight:bold;padding:2px;height:48px;padding:2px;width:"+(Math.floor(weight*10)/10)+"%;display: table;_position:relative;overflow:hidden;'><div style='vertical-align: middle;display: table-cell;_position: absolute;_top: 50%;'><div style='_position: relative;_top: -50%;'>"+needTypes[type] + " "+Number(weight.toFixed(1))+"%</div></div></div>");
        });        
    }

    //查询得到待添加需要列表，注意类型为Need
    $.ajax({
        url:app.config.sx_api+"/mod/occasionNeed/rest/pending-needs/"+occasionId,
        type:"get",
        //data:JSON.stringify({}),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===got pending occasions===\n",ret);
            if(ret && ret.length>0 && $("#createNeedBtn").length==0){  //避免重复添加
                //逐条添加，注意是need节点
                ret.forEach(function(node){
                    var needtypeColor = "color:"+needTypeColor[node.type]+";border:1px solid "+needTypeColor[node.type];
                    var html = '<div class="sxTag0" id="need'+node.id+'" data-id="'+node.id+'" data-name="'+node.name+'" style="'+needtypeColor+'">';
                    html += node.name;
                    html += '</div>';
                    if($("#need"+node.id).length==0){ //排重
                        $("#occasionNeedsDiv"+node.type).append(html);
                        //注册点击事件：点击后弹出浮框完成修改或删除
                        $("#need"+node.id).click(function(){ 
                            //新增occasionNeed
                            occasionNeed = {
                                name: $(this).data("name"),
                                occasion: {id: occasionId}, //设置当前occasion
                                need: {id: $(this).data("id")} //直接将当前选中属性作为occasionNeed 的关联属性
                            };
                            showOccasionNeedInfoForm();
                        });
                    }
                });                
            }else{
              console.log("no more pending needs.");   
            }


            //添加按钮：按照类型逐个添加
            Object.keys(needTypes).forEach(function(needType){
                if($("#createNeedBtn"+needType).length==0){ //排重
                    $("#occasionNeedsDiv"+needType).append('<div class="sxTagNew createNeedBtn" id="createNeedBtn'+needType+'" data-type="'+needType+'" style="background-color:#514c49;border:1px solid #514c49;color:#fff;">+ 添加</div>');
                    $("#occasionNeedsTitle"+needType).empty();
                    $("#occasionNeedsTitle"+needType).html("<span>设置/添加 "+needTypes[needType]+"</span>");
                    $("#occasionNeedsTitle"+needType).css("display","block");
                }
            });
            /**
            if($("#createNeedBtn").length==0){ //排重
                $("#occasionNeedsDiv").append('<div class="sxTagNew createNeedBtn" id="createNeedBtn" data-type="" style="background-color:#514c49;border:1px solid #514c49;color:#fff;">+ 添加</div>');
                $("#occasionNeedsTitle").empty();
                $("#occasionNeedsTitle").html("<span>设置/添加 更多需要</span>");
                $("#occasionNeedsTitle").css("display","block");
            }
            //**/
            
            //注册事件
            $(".createNeedBtn").click(function(){ 
                //设置空白phase
                occasionNeed = {}
                //设置needType
                if($(this).data("type")&&$(this).data("type").trim().length>0){
                    needType = $(this).data("type");
                    //高亮
                    $("div[id^=needType]").each(function(){
                        $(this).css("background-color","#fff");
                        $(this).css("color",needTypeColor[$(this).data("type")]);                         
                    });
                    $("#needType"+needType).css("background-color",needTypeColor[needType]);
                    $("#needType"+needType).css("color","#fff");                    
                }
                showNeedInfoForm();
            }); 

        }
    });        

}
//操作按钮：显示occasionNeed修改表单
function showOccasionNeedInfoForm(){
    console.log("show occasionNeed form.",occasionNeed);  
    //显示数据填报表单
    $.blockUI({ message: $('#occasionneedform'),
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
    //设置默认值：对于有选定occasionNeed的情况
    $("#occasionNeedWeightStars").starRating("setRating",0); //先恢复为0
    if(occasionNeed && occasionNeed.id && occasionNeed.id.trim().length>0){ //已经关联的属性
        $("#occasionNeedName2").val("需要："+occasionNeed.need.name);
        $("#occasionNeedWeight2").val(occasionNeed.weight);
        //打分
        $("#occasionNeedWeightStars").starRating("setRating",occasionNeed.weight);         
    }else if(occasionNeed && occasionNeed.name && occasionNeed.name.trim().length>0){ //已存在但未关联属性
        $("#occasionNeedName2").val("需要："+occasionNeed.name);
    }else{//新建属性
        $("#occasionNeedName2").val("");
        $("#occasionNeedWeight2").val("");        
    }
    //判定是否显示删除按钮：仅对于已经存在的指标显示删除按钮
    if(occasionNeed && occasionNeed.id && occasionNeed.id.trim().length>0){
        $("#btnDeleteOccasionNeed").css("display","block");
    }else{
        $("#btnDeleteOccasionNeed").css("display","none");
    }

}
//保存occasion信息：完成后关闭浮框，并且刷新数据
function saveOccasionNeedInfo(occasionNeed){
    console.log("try to save occasionNeed info.",occasionNeed,JSON.stringify(occasionNeed));
    $.ajax({
        url:app.config.sx_api+"/mod/occasionNeed/rest/occasion-need",
        type:"post",
        data:JSON.stringify(occasionNeed),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===save occasionNeed done===\n",ret);
            if(ret.success){ 
                //取消浮框，并刷新界面
                $.unblockUI(); //直接取消即可
                loadDimensionInfo();
            }
        }
    });
}
//删除occasion信息：完成后关闭浮框，并且刷新数据
function deleteOccasionNeedInfo(occasionNeed){
    console.log("try to delete occasionNeed info.",occasionNeed);
    $.ajax({
        url:app.config.sx_api+"/mod/occasionNeed/rest/occasion-need",
        type:"put",//DELETE方法遇到CORS问题，采用PUT
        data:JSON.stringify(occasionNeed),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===delete occasionNeed done===\n",ret);
            if(ret.success){ 
                //取消浮框，并刷新界面
                $.unblockUI(); //直接取消即可
                loadOccasionNeeds();
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

}
//保存need信息：完成后需要继续提交建立occasionNeed，并且关闭浮框
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
                //建立occasionNeed
                saveOccasionNeedInfo({
                    occasion:{id: occasionId},
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
//保存occasionNeed信息：完成后关闭浮框，并且刷新数据
function saveOccasionNeedInfo(occasionNeed){
    console.log("try to save occasionNeed info.",occasionNeed,JSON.stringify(occasionNeed));
    $.ajax({
        url:app.config.sx_api+"/mod/occasionNeed/rest/occasion-need",
        type:"post",
        data:JSON.stringify(occasionNeed),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===save occasionNeed done===\n",ret);
            if(ret.success){ 
                //取消浮框，并刷新界面
                $.unblockUI(); //直接取消即可
                loadOccasionNeeds();
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
      //link: (d, n) => `${d.href}`,//`https://www.biglistoflittlethings.com/ilife-web-wx/expert/occasion.html?occasionId=${d.occasionId}&id=${d.id}`,
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
        //console.log("image uri.",dataURLtoFile(uri,"occasion.png"));
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
function loadPersona(occasionId){
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 
    util.AJAX(app.config.data_api+"/_api/document/occasion_occasions/"+occasionId, function (res) {
        console.log("Broker::My Loaded occasion by id.", res)
        if(res){
            currentPersona = res;
            currentPerson = {//直接引用occasion属性作为当前用户设置
              ...res
            };
            delete  currentPerson._key;
            delete  currentPerson._id;
            delete  currentPerson._rev;
            delete  currentPerson.broker;
            delete  currentPerson.image;
            delete  currentPerson.name;
            currentPerson.occasion = res;//设置当前用户的occasion信息
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
    window.location.href = "index.html?type="+(currentPerson.openId?"person":"occasion")+"&id="+currentPerson._key;
}
function goActionHistory(){
    window.location.href = "feeds.html?type="+(currentPerson.openId?"person":"occasion")+"&id="+currentPerson._key;
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
        var key = md5(currentPerson.occasion._key+userInfo._key+new Date().getTime(),16);//构建一个user._key。注意用短md5，构成差异，并且避免微信 二维码 scene_str 总长64位限制
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
        console.log("Broker::My Loaded occasion tags.", res)
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
        var tagType = tag.userTagOccasion.name;
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
        var userTagByOccasion = userTagTypes[i];
        //添加标签分类及分割线
        $("#user-tags-div").append("<div class='user-tag-wrapper-separator'></div>");
        $("#user-tags-div").append("<div class='user-tag-wrapper' id='user-tag-wrapper-"+userTagByOccasion+"'></div>");
        //添加分类文字
        $("#user-tag-wrapper-"+userTagByOccasion).append('<div class="user-tag-occasion">'+userTagByOccasion+'</div>');
        //添加具体标签
        var taglist = userTags[userTagByOccasion];
        $("#user-tag-wrapper-"+userTagByOccasion).append('<div class="user-tag-list" id="user-tag-list-'+userTagByOccasion+'"></div>');
        for(var j=0;j<taglist.length;j++){
            var tag = taglist[j];

            //创建动态判定脚本，并检查是否已经选中
            var myScript= document.createElement("script");
            myScript.type = "text/javascript";
            myScript.appendChild(document.createTextNode('function checkTag'+tag.id+'(doc){console.log("try to eval tag expr.",doc); return '+tag.ruleOfJudgment+';}'));
            document.body.appendChild(myScript); 

            //组织tag HTML            
            $("#user-tag-list-"+userTagByOccasion).append('<div class="user-tag" id="tag'+tag.userTagOccasion.id+'-'+tag.id+'" data-tagId="'+tag.id+'" data-name="'+tag.name+'" data-rule=\''+tag.ruleOfJudgment+'\' data-occasionId="'+tag.userTagOccasion.id+'" data-type="'+tag.userNeed.type+'" data-property="'+tag.userNeed.property+'" data-isExclusive="'+tag.userTagOccasion.isExclusive+'" data-expr=\''+tag.expression+'\'>'+tag.name+'</div>');
            //注册点击事件
            $("#tag"+tag.userTagOccasion.id+'-'+tag.id).click(function(e){
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
                occasionId:tag.userTagOccasion.id,                              
                isExclusive:tag.userTagOccasion.isExclusive
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
        occasionId:e.currentTarget.dataset.occasionid,
        isExclusive:e.currentTarget.dataset.isexclusive
    });
}

//修改tag显示风格
function changeTagDisplay(tagInfo){
    //console.log("try to change tag style.",tagInfo);
    if(tagInfo.isExclusive=="1" || tagInfo.isExclusive==1){    //如果是单选，则先把所有已选中的干掉，然后把选中的加上高亮
        //把同一类标签风格都改为取消状态
        console.log("change exclusive tag.",tagInfo)
        $("div[id^='tag"+tagInfo.occasionId+"']").each(function(index, element) {
             $(this).removeClass("user-tag-selected");
             $(this).addClass("user-tag");
        });   
        //高亮显示当前选中的标签 
        $("#"+tagInfo.occasionId+'-'+tagInfo.tagId).removeClass("user-tag");
        $("#tag"+tagInfo.occasionId+'-'+tagInfo.tagId).addClass("user-tag-selected");        
    }else{//对于多选，如果当前值在列表内则加上高亮，如果不在则去掉高亮
        console.log("\n\nchange non-exclusive tag.",tagInfo)
        if(currentPerson[tagInfo.property] && currentPerson[tagInfo.property].indexOf(tagInfo.name)>=0){
            $("#tag"+tagInfo.occasionId+'-'+tagInfo.tagId).removeClass("user-tag");
            $("#tag"+tagInfo.occasionId+'-'+tagInfo.tagId).addClass("user-tag-selected");             
        }else{
            $("#tag"+tagInfo.occasionId+'-'+tagInfo.tagId).removeClass("user-tag-selected");
            $("#tag"+tagInfo.occasionId+'-'+tagInfo.tagId).addClass("user-tag");             
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
        if((res.persona && res.persona._key) || !res.openId){//如果有occasion则显示表单。注意：对于通过画像生成虚拟用户则直接显示表单，通过有无openId判断
            insertPerson(userInfo);//TODO:当前直接显示默认信息，需要改进为显示broker信息，包括等级、个性化logo等
            showPerson(currentPerson);//显示设置的用户表单
            loadBrokerByOpenid(userInfo._key);//根据当前登录用户openid加载broker信息
        }else{//没有occasion则提示先选择一个occasion
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


//修改occasion的tags：每次修改后均做更新，且仅更新tags
function updatePersonaTags(){
    var data={
        tags:currentPersona.tags//在发生操作后直接修改
    }
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 
    util.AJAX(app.config.data_api+"/_api/document/occasion_occasions/"+currentPersona._key, function (res) {
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


