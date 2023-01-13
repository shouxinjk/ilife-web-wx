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
    if(args["dimensionId"]){
        dimensionId = args["dimensionId"]; //记录当前修改节点维度
    }   
    if(args["categoryId"]){
        categoryId = args["categoryId"]; //记录当前修改节点维度
    }    
    if(args["personaId"]){
        currentPersonaId = args["personaId"]; //初次设置时，默认使用persona属性填充
    }

    $("body").css("background-color","#fff");//更改body背景为白色

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });      
    //loadPerson(currentPersonId);//加载需要修改的用户信息

    //注册事件：进入排行界面，验证模型结果是否合理
    $("#vailidateBtn").click(function(e){
        window.location.href="../measures.html?categoryId="+categoryId+"&categoryName=模型验证"+(categoryName?":"+categoryName:"");
    });

    //加载所有类目列表：注意是加载全部类目
    loadCategories();//加载后将自动高亮，并加载维度数据
    //加载维度定义数据
    //loadDimensionInfo();

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

var dimensionId = null;
var categoryId = null;
var categoryName = null;

var currentPerson = {};//默认当前修改用户为空

var dimensionMeasures = [];//关联的measure列表
var dimensions = [];//下级指标列表

var dimension = {};//记录当前操作的dimension
var dimensionMeasure = {};//记录当前操作的dimensionMeasure，注意新增measure是直接完成

var weightSum = 0; //记录权重之和，如果不等于100则显示提示信息


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
    //默认维度与类目保持一致，如果有则使用传递的dimensionId
    dimensionId = category.id;

    if(category.description && category.description.trim().length>0){
        $("#summaryDiv").css("display","block");
        $("#summary").html(category.description);
    }

    loadDimensionInfo();//重新加载数据
} 

//切换Dimension，支持向下钻取
function changeDimension (subId) {
    console.log("change dimension.",subId);
    dimensionId = subId;
    loadDimensionInfo();//重新加载数据
} 

//装载维度数据
function loadDimensionInfo(){
    weightSum = 0;
    if(!dimensionId){
        console.log("dimensionId or categoryId cannot be null.");
        return;
    }
    //根据dimensionId获取指标路径
    console.log("try to load dimension on full path.",dimensionId);
    $.ajax({
        url:app.config.sx_api+"/mod/itemDimension/rest/full-dimension/"+dimensionId,
        type:"get",
        //data:JSON.stringify(dimension),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===got dimension full path===\n",ret);
            if(ret && ret.length>0){
                $("#treemapTitle").empty();
                ret.forEach(function(node){
                    if(node.id.length>1){
                        $("#treemapTitle").prepend("<span style='padding:0 2px;/*color:#007bff;*/' id='fullpath"+node.id+"' data-id='"+node.id+"'>"+node.name+"</span>");
                        $("#fullpath"+node.id).click(function(){//点击切换
                            //window.location.href = "dimension.html?categoryId="+categoryId+"&id="+$(this).data("id");
                            dimensionId = node.id;
                            loadDimensionInfo();
                        });
                        categoryName = node.name; //设置类目名称，将自动追溯到根节点
                    }
                })
                
            }
        }
    });

    //根据dimensionId加载数据
    var data = { dimensionId: dimensionId };
    console.log("try to load dimension data.",data);
    util.AJAX(app.config.sx_api+"/mod/itemDimension/rest/child", function (res) {
        console.log("======\nload dimension.",data,res);
        weightSum = 0; //重要！！在加载指标及属性后需要将权重汇总置零，否则会导致重复叠加问题
        if (res.success) {//显示图形：合并返回的子节点及属性列表
            dimensionMeasures = res.measures;
            dimensions = res.dimensions;
            //把子指标及属性 数据融合到一起
            var nodes = [];
            if(dimensions && dimensions.length>0){//合并子级指标
                dimensions.forEach(function(node){
                    weightSum += node.weight;
                    nodes.push({
                        name: node.name,
                        id: node.id,
                        type: "dimension",
                        categoryId: categoryId,
                        //href:"https://www.biglistoflittlethings.com/ilife-web-wx/expert/dimension.html?categoryId="+categoryId+"&dimensionId="+node.id+"&categoryName="+categoryName,
                        href:"javascript:changeDimension('"+node.id+"')",
                        weight: node.weight
                    });
                });
            }
            
            if(dimensionMeasures && dimensionMeasures.length>0){//合并子级指标
                dimensionMeasures.forEach(function(node){
                    weightSum += node.weight;
                    nodes.push({
                        name: node.measure.name,
                        id: node.measure.id,
                        type: "measure",
                        categoryId: categoryId,
                        href: "#",
                        weight: node.weight
                    });
                });
            }    

            showDimensions();//显示指标列表供操作 
            showDimensionMeasures();//显示属性列表供操作       
            showTreemap( nodes );

            if(weightSum>0 && weightSum != 100){ //显示权重调整提示
                $("#treemapTips").html("权重加和为"+weightSum+"，请调整，使加和等于100");
                $("#treemapTips").css("display","block");
            }else{
                $("#treemapTips").css("display","none");
            }

        }else{//没有则啥也不干，等待建立评价体系
            dimensionMeasures = [];
            dimensions = [];

            showDimensions();//显示指标列表供操作 
            showDimensionMeasures();//显示属性列表供操作                
            $("#treemap").empty();//清空已经加载的treemap
            //do nothing
            console.log("failed load dimension tree.",data);
        }
    },"GET",data);    
    //**/
    /**
    var data = { categoryId: categoryId, parentId: dimensionId };
    console.log("try to load dimension data.",data);
    util.AJAX(app.config.sx_api+"/mod/itemDimension/rest/dim-tree", function (res) {
        console.log("======\nload dimension.",data,res);
        var nodes = [];
        if(res){//合并子级指标
            res.forEach(function(node){
                prepareNodes(nodes, null, node);
            });
        }           
        showTreemap( nodes );
    },"GET",data);     
    //**/ 
}

//递归将所有指标及属性节点组合为一个列表
function prepareNodes(nodes, prefix, node){
    nodes.push({
        name: prefix?prefix+"."+node.name : node.name,
        categoryId: categoryId,
        weight: node.weight
    });
    if(node.children){
        node.children.forEach(function(child){
            prepareNodes(nodes, prefix?prefix+"."+node.name:node.name, child);
        });        
    }    
}

//显示指标列表：能够直接发起增、删、改操作
function showDimensions(){
    //先清空
    $("#dimensionsDiv").empty();

    //逐条显示
    if(dimensions&&dimensions.length>0){
        dimensions.forEach(function(node){
            var tagclass = node.weight<0.1?"sxTag0":"dimensionTag"; //权重较低则灰色显示
            var html = '<div class="'+tagclass+'" id="dim'+node.id+'" data-id="'+node.id+'">';
            html += node.name + " "+ node.weight+"%";
            html += '</div>';
            $("#dimensionsDiv").append(html);
            //注册点击事件：点击后弹出浮框完成修改或删除
            $("#dim"+node.id).click(function(){ 
                //从列表里取出当前操作的dimension
                var currentDimensionId = $(this).data("id");
                dimension = dimensions.find(item => item.id == currentDimensionId);
                if(dimension){
                    showDimensionInfoForm();
                }else{
                    console.log("no dimension found by id.",currentDimensionId);
                }
            });
        });
    }

    //添加新增条目并注册事件
    $("#dimensionsDiv").append('<div class="sxTagNew" id="createDimensionBtn">添加评价指标</div>');
    //注册点击事件：点击后弹出浮框完成修改或删除
    $("#createDimensionBtn").click(function(){ 
        //设置空白dimension
        dimension = {}
        showDimensionInfoForm();
    });

}
//操作按钮：显示dimension修改表单
function showDimensionInfoForm(){
    console.log("show dimension form.",dimension);  
    //显示数据填报表单
    $.blockUI({ message: $('#dimensionform'),
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
    //设置默认值：对于有选定dimension的情况
    if(dimension && dimension.id && dimension.id.trim().length>0){
        $("#dimensionName2").val(dimension.name);
        $("#dimensionWeight2").val(dimension.weight);
        $("#dimensionDesc2").val(dimension.description);
    }else{
        $("#dimensionName2").val("");
        $("#dimensionWeight2").val("");
        $("#dimensionDesc2").val("");        
    }
    //判定是否显示删除按钮：仅对于已经存在的指标显示删除按钮
    if(dimension && dimension.id && dimension.id.trim().length>0){
        $("#btnDeleteDimension").css("display","block");
    }else{
        $("#btnDeleteDimension").css("display","none");
    }
    $("#btnCancelDimension").click(function(){      
        $.unblockUI(); //直接取消即可
    });
    $("#btnDeleteDimension").click(function(){//完成后需要刷新数据，包括treemap、指标列表、属性列表
        console.log("try to delete item.");
        deleteDimensionInfo(dimension);
    });    
    $("#btnSaveDimension").click(function(){//完成后需要刷新数据，包括treemap、指标列表、属性列表
        if( !$("#dimensionName2").val() || $("#dimensionName2").val().trim().length ==0 ){
            $("#dimensionName2").val(dimension.name);
            siiimpleToast.message('名称为必填~~',{
              position: 'bottom|center'
            });                 
        }else if( !$("#dimensionWeight2").val() || $("#dimensionWeight2").val().trim().length ==0 ){
            $("#dimensionWeight2").val(dimension.weight);
            siiimpleToast.message('指标占比为必填~~',{
              position: 'bottom|center'
            });                 
        }else if( !$("#dimensionDesc2").val() || $("#dimensionDesc2").val().trim().length ==0 ){
            $("#dimensionDesc2").val(dimension.description);
            siiimpleToast.message('描述为必填~~',{
              position: 'bottom|center'
            });                 
        }else{
            console.log("try to save new item.");
            dimension.name = $("#dimensionName2").val();
            dimension.weight = $("#dimensionWeight2").val();
            dimension.description = $("#dimensionDesc2").val();
            if(!dimension.id || dimension.id.trim().length==0){ //如果是新建，则补充默认属性
                dimension.scriptType = "auto";//设置为自动计算类型
                dimension.featured = dimensionId==categoryId?true:false,//仅第一层指标设为特征指标
                dimension.category = {
                    id: categoryId
                };
            }
            dimension.parent = { //设置上级节点id
                id: dimensionId
            };            
            saveDimensionInfo(dimension);
        }
    });
}
//保存dimension信息：完成后关闭浮框，并且刷新数据
function saveDimensionInfo(dimension){
    console.log("try to save dimension info.",dimension,JSON.stringify(dimension));
    $.ajax({
        url:app.config.sx_api+"/mod/itemDimension/rest/dimension",
        type:"post",
        data:JSON.stringify(dimension),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===save dimension done===\n",ret);
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
//删除dimension信息：完成后关闭浮框，并且刷新数据
function deleteDimensionInfo(dimension){
    console.log("try to delete dimension info.",dimension);
    $.ajax({
        url:app.config.sx_api+"/mod/itemDimension/rest/dimension/"+dimension.id,
        type:"put",//DELETE方法遇到CORS问题，采用PUT
        //data:JSON.stringify(dimension),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===delete dimension done===\n",ret);
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

//显示属性列表：能够直接发起增、删、改操作。显示时需要结合所有可选属性，以及已添加属性进行。
function showDimensionMeasures(){
    //先清空
    $("#dimensionMeasuresDiv").empty();

    //逐条显示已经添加的属性节点
    if(dimensionMeasures && dimensionMeasures.length>0){
        dimensionMeasures.forEach(function(node){
            var tagclass = node.weight<0.1?"sxTag0":"measureTag"; //权重较低则灰色显示
            var html = '<div class="'+tagclass+'" id="dimmeasure'+node.id+'" data-id="'+node.id+'">';
            html += node.measure.name + " "+ node.weight+"%";
            html += '</div>';
            $("#dimensionMeasuresDiv").append(html);
            //注册点击事件：点击后弹出浮框完成修改或删除
            $("#dimmeasure"+node.id).click(function(){ 
                //从列表里取出当前操作的dimensionMeasure
                var currentDimensionMeasureId = $(this).data("id");
                dimensionMeasure = dimensionMeasures.find(item => item.id == currentDimensionMeasureId);
                if(dimensionMeasure){
                    showDimensionMeasureInfoForm();
                }else{
                    console.log("no dimensionMeasure found by id.",currentDimensionMeasureId);
                }
            });
        });        
    }

    //查询得到可添加属性及继承属性。注意返回为measure列表
    $.ajax({
        url:app.config.sx_api+"/mod/itemDimensionMeasure/rest/pending-measures/"+categoryId+"/"+dimensionId,
        type:"get",
        //data:JSON.stringify({}),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===got pending dimensions===\n",ret);
            if(ret.success && ret.pendingMeasures && $("#createMeasureBtn").length==0){  //避免重复添加
                //逐条添加，注意是measure节点
                ret.pendingMeasures.forEach(function(node){
                    var html = '<div class="sxTag0" id="measure'+node.id+'" data-id="'+node.id+'" data-name="'+node.name+'">';
                    html += node.name;
                    html += '</div>';
                    $("#dimensionMeasuresDiv").append(html);
                    //注册点击事件：点击后弹出浮框完成修改或删除
                    $("#measure"+node.id).click(function(){ 
                        //新增dimensionMeasure
                        dimensionMeasure = {
                            name: $(this).data("name"),
                            dimension: {id: dimensionId}, //设置当前指标
                            measure: {id: $(this).data("id")} //直接将当前选中属性作为diemsnionMeasure 的关联属性
                        };
                        showDimensionMeasureInfoForm();
                    });
                });                

            }else{
              console.log("no more pending measures.");   
            }

            //增加创建按钮:避免重复添加
            if($("#createMeasureBtn").length==0){ 
                //添加新增measure并注册事件
                $("#dimensionMeasuresDiv").append('<div class="sxTagNew" id="createMeasureBtn">添加数据字段</div>');
                //注册点击事件：点击后弹出浮框完成修改或删除
                $("#createMeasureBtn").click(function(){ 
                    //设置空白dimension
                    dimensionMeasure = {}
                    showMeasureInfoForm();
                });
            }

        }
    });        

}
//操作按钮：显示dimensionMeasure修改表单
function showDimensionMeasureInfoForm(){
    console.log("show dimensionMeasure form.",dimensionMeasure);  
    //显示数据填报表单
    $.blockUI({ message: $('#dimensionmeasureform'),
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
    //设置默认值：对于有选定dimensionMeasure的情况
    if(dimensionMeasure && dimensionMeasure.id && dimensionMeasure.id.trim().length>0){ //已经关联的属性
        $("#dimensionMeasureName2").val(dimensionMeasure.name);
        $("#dimensionMeasureWeight2").val(dimensionMeasure.weight);
    }else if(dimensionMeasure && dimensionMeasure.name && dimensionMeasure.name.trim().length>0){ //已存在但未关联属性
        $("#dimensionMeasureName2").val(dimensionMeasure.name);
    }else{//新建属性
        $("#dimensionMeasureName2").val("");
        $("#dimensionMeasureWeight2").val("");        
    }
    //判定是否显示删除按钮：仅对于已经存在的指标显示删除按钮
    if(dimensionMeasure && dimensionMeasure.id && dimensionMeasure.id.trim().length>0){
        $("#btnDeleteDimensionMeasure").css("display","block");
    }else{
        $("#btnDeleteDimensionMeasure").css("display","none");
    }
    $("#btnCancelDimensionMeasure").click(function(){      
        $.unblockUI(); //直接取消即可
    });
    $("#btnDeleteDimensionMeasure").click(function(){//完成后需要刷新数据，包括treemap、指标列表、属性列表
        console.log("try to delete item.");
        deleteDimensionMeasureInfo(dimensionMeasure);
    });    
    $("#btnSaveDimensionMeasure").click(function(){//完成后需要刷新数据，包括treemap、指标列表、属性列表
        if( !$("#dimensionMeasureWeight2").val() || $("#dimensionMeasureWeight2").val().trim().length ==0 ){
            $("#dimensionMeasureWeight2").val(dimensionMeasure.weight);
            siiimpleToast.message('数据占比为必填~~',{
              position: 'bottom|center'
            });                 
        }else{
            console.log("try to save new item.");
            dimensionMeasure.weight = $("#dimensionMeasureWeight2").val();//仅需设置权重即可，measureId及dimensionId已提前完成设置
            saveDimensionMeasureInfo(dimensionMeasure);
        }
    });
}
//保存dimension信息：完成后关闭浮框，并且刷新数据
function saveDimensionMeasureInfo(dimensionMeasure){
    console.log("try to save dimensionMeasure info.",dimensionMeasure,JSON.stringify(dimensionMeasure));
    $.ajax({
        url:app.config.sx_api+"/mod/itemDimensionMeasure/rest/dimension-measure",
        type:"post",
        data:JSON.stringify(dimensionMeasure),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===save dimensionMeasure done===\n",ret);
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
//删除dimension信息：完成后关闭浮框，并且刷新数据
function deleteDimensionMeasureInfo(dimensionMeasure){
    console.log("try to delete dimensionMeasure info.",dimensionMeasure);
    $.ajax({
        url:app.config.sx_api+"/mod/itemDimensionMeasure/rest/dimension-measure/"+dimensionMeasure.id,
        type:"put",//DELETE方法遇到CORS问题，采用PUT
        data:JSON.stringify(dimensionMeasure),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===delete dimensionMeasure done===\n",ret);
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
//操作按钮：显示新增measure表单：注意measure表单仅提供新增，不提供修改或删除操作
function showMeasureInfoForm(){
    console.log("show measure form.");  
    //显示数据填报表单
    $.blockUI({ message: $('#measureform'),
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
    $("#btnCancelMeasure").click(function(){      
        $.unblockUI(); //直接取消即可
    });   
    $("#btnSaveMeasure").click(function(){//保存属性，并且直接保存dimensionMeasure关联设置，完成后刷新数据
        if( !$("#measureWeight2").val() || $("#measureWeight2").val().trim().length ==0 ){
            siiimpleToast.message('数据占比为必填~~',{
              position: 'bottom|center'
            });                 
        }else if( !$("#measureName2").val() || $("#measureName2").val().trim().length ==0 ){
            siiimpleToast.message('字段名称为必填~~',{
              position: 'bottom|center'
            });                 
        }else{
            console.log("try to save new measure item.");
            saveMeasureInfo(
                $("#measureName2").val().trim(),
                $("#measureValue2").val().trim().length>0?$("#measureValue2").val().trim():"",
                $("#measureTags2").val().trim().length>0?$("#measureTags2").val().trim():"",
                $("#measureWeight2").val().trim()
            );
        }
    });
}
//保存measure信息：完成后需要继续提交建立dimensionMeasure，并且关闭浮框
function saveMeasureInfo(name,defaultValue,tags,weight){
    var measure = { //构建空白measure信息，全部采用默认值填写
        name: name,
        tags: tags,
        defaultValue: defaultValue,

        category: {
            id: categoryId //默认建立到当前目录下
        },

        alpha: 0.2,
        beta: 0.2,
        gamma: 0.2,
        delte: 0.2,
        epsilon: 0.2,

        zeta: 0.5,
        eta: 0.3,
        theta: 0.2,

        isModifiable: 1,
        autoLabelType: "manual",
        normalizeType: "min-max",
        multiValueFunc: "avg",
        expression: "",
        defaultScore: 0

    };
    console.log("try to save measure info.",measure);
    $.ajax({
        url:app.config.sx_api+"/mod/measure/rest/measure",
        type:"post",
        data:JSON.stringify(measure),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===save measure done===\n",ret);
            if(ret.success && ret.data){ 
                //先取消浮框
                //$.unblockUI(); //直接取消即可
                //建立dimensionMeasure
                saveDimensionMeasureInfo({
                    name: name,
                    dimension:{id: dimensionId},
                    measure:{id: ret.data.id},
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
//保存dimensionMeasure信息：完成后关闭浮框，并且刷新数据
function saveDimensionMeasureInfo(dimensionMeasure){
    console.log("try to save dimensionMeasure info.",dimensionMeasure,JSON.stringify(dimensionMeasure));
    $.ajax({
        url:app.config.sx_api+"/mod/itemDimensionMeasure/rest/dimension-measure",
        type:"post",
        data:JSON.stringify(dimensionMeasure),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===save dimensionMeasure done===\n",ret);
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



//load person
function loadPerson(personId) {
    console.log("try to load person info.",personId);
    util.AJAX(app.config.data_api+"/user/users/"+personId, function (res) {
        console.log("load person info.",personId,res);
        //userInfo = res;
        currentPerson = res;
        //检查是否有persona设置，如果没有则跳转到persona选择界面
        if((res.persona && res.persona._key) || !res.openId){//如果有persona则显示表单。注意：对于通过画像生成虚拟用户则直接显示表单，通过有无openId判断
            insertPerson(userInfo);//TODO:当前直接显示默认信息，需要改进为显示broker信息，包括等级、个性化logo等
            showPerson(currentPerson);//显示设置的用户表单
            loadBrokerByOpenid(userInfo._key);//根据当前登录用户openid加载broker信息
        }else{//没有persona则提示先选择一个persona
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



