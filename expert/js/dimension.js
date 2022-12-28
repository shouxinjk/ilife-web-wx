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
    if(args["id"]){
        dimensionId = args["id"]; //记录当前修改节点维度
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
    loadPerson(currentPersonId);//加载需要修改的用户信息

    //注册事件：进入排行界面，验证模型结果是否合理
    $("#vailidateBtn").click(function(e){
        window.location.href="../measures.html?categoryId="+categoryId+"&categoryName=模型验证"+(categoryName?":"+categoryName:"");
    });

    //加载维度定义数据
    loadDimensionInfo();

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
                        href:"https://www.biglistoflittlethings.com/ilife-web-wx/expert/dimension.html?categoryId="+categoryId+"&id="+node.id,
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

        }else{//没有则啥也不干
            dimensionMeasures = [];
            dimensions = [];
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
function loadPersona(personaId){
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 
    util.AJAX(app.config.data_api+"/_api/document/persona_personas/"+personaId, function (res) {
        console.log("Broker::My Loaded persona by id.", res)
        if(res){
            currentPersona = res;
            currentPerson = {//直接引用persona属性作为当前用户设置
              ...res
            };
            delete  currentPerson._key;
            delete  currentPerson._id;
            delete  currentPerson._rev;
            delete  currentPerson.broker;
            delete  currentPerson.image;
            delete  currentPerson.name;
            currentPerson.persona = res;//设置当前用户的persona信息
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
    window.location.href = "index.html?type="+(currentPerson.openId?"person":"persona")+"&id="+currentPerson._key;
}
function goActionHistory(){
    window.location.href = "feeds.html?type="+(currentPerson.openId?"person":"persona")+"&id="+currentPerson._key;
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
        var key = md5(currentPerson.persona._key+userInfo._key+new Date().getTime(),16);//构建一个user._key。注意用短md5，构成差异，并且避免微信 二维码 scene_str 总长64位限制
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
        console.log("Broker::My Loaded persona tags.", res)
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
            $("#user-tag-list-"+userTagByCategory).append('<div class="user-tag" id="tag'+tag.userTagCategory.id+'-'+tag.id+'" data-tagId="'+tag.id+'" data-name="'+tag.name+'" data-rule=\''+tag.ruleOfJudgment+'\' data-categoryId="'+tag.userTagCategory.id+'" data-type="'+tag.userMeasure.type+'" data-property="'+tag.userMeasure.property+'" data-isExclusive="'+tag.userTagCategory.isExclusive+'" data-expr=\''+tag.expression+'\'>'+tag.name+'</div>');
            //注册点击事件
            $("#tag"+tag.userTagCategory.id+'-'+tag.id).click(function(e){
                changeTag(e);
            }); 
    
            //检查tag状态
            checkTagStatus({
                tagId:tag.id,
                name:tag.name,
                type:tag.userMeasure.type,
                property:tag.userMeasure.property,  
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


//修改persona的tags：每次修改后均做更新，且仅更新tags
function updatePersonaTags(){
    var data={
        tags:currentPersona.tags//在发生操作后直接修改
    }
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 
    util.AJAX(app.config.data_api+"/_api/document/persona_personas/"+currentPersona._key, function (res) {
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


