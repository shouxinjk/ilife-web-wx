// 文档加载完毕后执行
$(document).ready(function ()
{
    //根据屏幕大小计算字体大小
    const oHtml = document.getElementsByTagName('html')[0]
    const width = oHtml.clientWidth;
    var rootFontSize = 12 * (width / 1440);// 在1440px的屏幕基准像素为12px
    rootFontSize = rootFontSize <9 ? 9:rootFontSize;//最小为8px
    oHtml.style.fontSize = rootFontSize+ "px";
    //设置正文部分宽度
    galleryWidth = width;//占比100%
    galleryHeight = 9*galleryWidth/16;//宽高比为16:9
    $("#main").width(galleryWidth);
    //处理参数
    var args = getQuery();
    var category = args["category"]; //当前目录
    id = args["id"];//当前board id

    from = args["from"]?args["from"]:"mp";//可能为groupmessage,timeline等
    fromUser = args["fromUser"]?args["fromUser"]:"";//从连接中获取分享用户ID
    fromBroker = args["fromBroker"]?args["fromBroker"]:"";//从连接中获取分享达人ID。重要：将依据此进行收益计算

    //检查设置首次触达达人
    if(fromBroker && fromBroker.trim().length>0){
        util.checkInitBroker(fromBroker);
    }

    posterId = args["posterId"]?args["posterId"]:null;//从连接中获取海报ID，默认为空。如果没有则跳转到默认海报生成

    //推荐列表采用单列
    columnWidth = width -columnMargin*2;


    $('#waterfall').NewWaterfall({
        width: columnWidth,
        delay: 100,
    });  

    //需要判定进入来源：如果是通过分享链接进入则要重新获取openid

    //判断屏幕大小，如果是大屏则跳转
    /**
    if(width>=800){
        window.location.href=window.location.href.replace(/info2.html/g,"info.html");
    }
    //**/

    //加载达人信息
    //loadBrokerInfo();

    //加载内容
    loadSolution(id); //加载完成后将立即开始加载推荐列表
    //加载清单item列表
    loadSolutionItems(id);

    //加载导航和关注列表
    loadCategories(category);  
 
    //完成编辑按钮
    $("#goViewModeBtn").click(function(){
        window.location.href = "solution.html?id="+id;
    });
});

util.getUserInfo();//从本地加载cookie

//board id
var id = "null";
var bonusMin = 0;
var bonusMax = 0;

//临时用户
var tmpUser = "";

var items = [];//solution item 列表

var columnWidth = 800;//默认宽度600px
var columnMargin = 5;//默认留白5px
var galleryWidth = 672;
var galleryHeight = 378;
var num = 1;//需要加载的内容下标

//记录分享用户、分享达人
var from = "mp";//链接来源，默认为公众号进入
var fromUser = "";
var fromBroker = "";
var broker = {};//当前达人
var board = {};//当前board

var posterId = null;//海报模板ID

var solution  = null;//当前加载的方案信息
var solutionItemId = null;//当前选中的solutionItemId，在执行编辑操作时支持根据当前id完成
var currentSolutionItem = null; //当前选中的solutionItem，用于缓存，便于修改时使用

//优先从cookie加载达人信息
function loadBrokerInfo(){
  broker = util.getBrokerInfo();
}

//操作按钮：显示solution修改表单
function showSolutionInfoForm(){
    console.log("show solution form.");  
    //显示数据填报表单
    $.blockUI({ message: $('#solutionform'),
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
    $("#btnCancelSolution").click(function(){      
        $.unblockUI(); //直接取消即可
    });
    $("#btnSaveSolution").click(function(){//完成阅读后的奖励操作
        //检查数字url，胡乱填写不可以
        if( !$("#solutionName2").val() || $("#solutionName2").val().trim().length ==0 ){
            $("#solutionName2").val(solution.name);
            siiimpleToast.message('名称为必填~~',{
              position: 'bottom|center'
            });                 
        }else if( !$("#solutionDesc2").val() || $("#solutionDesc2").val().trim().length ==0 ){
            $("#solutionDesc2").val(solution.description);
            siiimpleToast.message('描述为必填~~',{
              position: 'bottom|center'
            });                 
        }else{
            console.log("try to save new item.");
            solution.name = $("#solutionName2").val();
            solution.description = $("#solutionDesc2").val();
            saveSolutionInfo(solution);
        }
    });
}
//保存solution信息：完成后关闭浮框，并且更新界面上title及desc描述
function saveSolutionInfo(solution){
    console.log("try to save solution info.",solution);
    $.ajax({
        url:app.config.sx_api+"/diy/solution/rest/solution",
        type:"post",
        data:JSON.stringify(solution),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===save solution done===\n",ret);
            if(ret.success){ 
                //提交索引
                indexSolutionDoc(solution);
                //取消浮框，并更新界面
                $("#solutionName").html(ret.data.name);
                $("#content").html(ret.data.description);
                $.unblockUI(); //直接取消即可
            }else{
              siiimpleToast.message('啊哦，出错了~~',{
                      position: 'bottom|center'
                    });    
            }
        }
    });
}

//提交索引。将整个文档提交ES建立所以，便于检索
function indexSolutionDoc(solution){
    var tags = [];
    if(solution.scheme.type=="guide"){
        tags.push("专家指南");
    }else if(solution.scheme.type=="free"){
        tags.push("个性化定制");
    }
    var logo = "http://www.biglistoflittlethings.com/static/logo/distributor/ilife.png";
    if(solution.scheme && solution.scheme.logo && solution.scheme.logo.trim().length>0)
      logo = solution.scheme.logo;
    var doc = {
        type: "solution", //固定为solution
        scheme: solution.scheme.id,
        itemkey: solution.id,   
        name: solution.name,
        description: solution.description, 
        tags: tags,              
        logo: logo,
        author: solution.byNickname,
        timestamp: new Date()
    }    
    console.log("try to index proposal doc.",doc,JSON.stringify(doc));
    var data = {
        records:[{
            value:doc
        }]
    };
    $.ajax({
        url: app.config.message_api+"/topics/proposal",
        type:"post",
        data:JSON.stringify(data),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/vnd.kafka.json.v2+json",
            "Accept":"application/vnd.kafka.v2+json"
        },
        success:function(result){
            console.log("solution indexed.");
            //window.location.href="index.html";
        }
    })     
}

//显示编辑当前条目表单
function showModifySolutionItemInfoForm(){
    console.log("show modify solution item form.");  

    //准备当前选中条目数据
    getCurrentSolutionItem();

    //填写数据
    //$("#solutionItemType2").val(currentSolutionItem.type);
    showSubtypeLogo(currentSolutionItem.type&&currentSolutionItem.type.id?currentSolutionItem.type.id:"section");//装载type logo
    $("#solutionItemName2").val(currentSolutionItem.name);
    $("#solutionItemDesc2").val(currentSolutionItem.description);
    $("#solutionItemTags2").val(currentSolutionItem.tags);

    //显示数据填报表单
    $.blockUI({ message: $('#solutionitemform'),
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
    $("#btnCancelSolutionItem").click(function(){      
        $.unblockUI(); //直接取消即可
    });
    $("#btnSaveSolutionItem").click(function(){//完成阅读后的奖励操作
        //检查输入
        if( !$("#solutionItemName2").val() || $("#solutionItemName2").val().trim().length ==0 ){
            $("#solutionItemName2").val(currentSolutionItem.name);
            siiimpleToast.message('名称为必填~~',{
              position: 'bottom|center'
            });                 
        }else if( !$("#solutionItemDesc2").val() || $("#solutionItemDesc2").val().trim().length ==0 ){
            $("#solutionItemDesc2").val(currentSolutionItem.description);
            siiimpleToast.message('描述为必填~~',{
              position: 'bottom|center'
            });                 
        }else{
            console.log("try to save item.");
            currentSolutionItem.name = $("#solutionItemName2").val();
            currentSolutionItem.tags = $("#solutionItemTags2").val();
            currentSolutionItem.description = $("#solutionItemDesc2").val();
            //currentSolutionItem.type = $("#solutionItemType2").val()?$("#solutionItemType2").val():"section";
            saveSolutionItemInfo(currentSolutionItem);
        }
    });
}

//显示新建条目表单：空白表单需要填写，并且需要根据当前条目计算priority
function showCreateSolutionItemInfoForm(){
    console.log("show blank solution item form.");  

    //设置一个空白solution
    currentSolutionItem = {
        solution:{
            id: solution.id
        },
        type:{
            id: "section"
        },
        name: "",
        tags: "",
        description: "",
        //type: $("#solutionItemType2").val()?$("#solutionItemType2").val():"section",
        priority: getPriority()
    };    

    //填写数据
    //$("#solutionItemType2").val("section");
    showSubtypeLogo("section");//装载type logo，新建时默认选择为分隔符
    $("#solutionItemName2").val("");
    $("#solutionItemDesc2").val("");
    $("#solutionItemTags2").val("");        

    //显示数据填报表单
    $.blockUI({ message: $('#solutionitemform'),
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
    $("#btnCancelSolutionItem").click(function(){      
        $.unblockUI(); //直接取消即可
    });
    $("#btnSaveSolutionItem").click(function(){//完成阅读后的奖励操作
        //检查输入
        if( !$("#solutionItemName2").val() || $("#solutionItemName2").val().trim().length ==0 ){
            siiimpleToast.message('名称为必填~~',{
              position: 'bottom|center'
            });                 
        }else if( !$("#solutionItemDesc2").val() || $("#solutionItemDesc2").val().trim().length ==0 ){
            siiimpleToast.message('描述为必填~~',{
              position: 'bottom|center'
            });                 
        }else{
            //根据模式检查设置priority：对于新建模式需要手动设置
            console.log("try to save item.");
            currentSolutionItem.name = $("#solutionItemName2").val();
            currentSolutionItem.tags = $("#solutionItemTags2").val();
            currentSolutionItem.description = $("#solutionItemDesc2").val();
            //currentSolutionItem.type = $("#solutionItemType2").val()?$("#solutionItemType2").val():"section";
            saveSolutionItemInfo(currentSolutionItem);            
            /**
            var nSolutionItem = {
                solution:{
                    id: solution.id
                },
                name: $("#solutionItemName2").val(),
                tags: $("#solutionItemTags2").val(),
                description: $("#solutionItemDesc2").val(),
                //type: $("#solutionItemType2").val()?$("#solutionItemType2").val():"section",
                priority: getPriority()
            };
            console.log("try to save new item.", nSolutionItem);
            saveSolutionItemInfo(nSolutionItem);
            //**/
        }
    });
}

//在增加条目时计算排序：在当前选中条目及其后一条中间插值
//第一条则取默认值，最后一条则增加步长，否则去中间值
function getPriority(){
    getCurrentSolutionItem();
    var prePriority=1;
    var postPriority=100;    

    if(currentSolutionItem && currentSolutionItem.priority){
        prePriority = currentSolutionItem.priority;

        var currentSolutionItemIndex = (items|| []).findIndex((item) => item.id === currentSolutionItem .id); //找到当前条目在items的下标
        if(currentSolutionItemIndex<items.length-1 && items[currentSolutionItemIndex+1] && items[currentSolutionItemIndex+1].priority){
            postPriority = items[currentSolutionItemIndex+1].priority;
            return (prePriority + postPriority)/2;
        } 
        return prePriority + postPriority;
    }else{//插入到第一条前面
        if(items && items.length>0){ //取第一条的半值
            return items[0].priority/2;
        }else{//否则就设为初始值
            return prePriority;
        }
        
    }

}

//重新设置当前SolutionItem
function getCurrentSolutionItem(){
    console.log("try get solutionItem.",solutionItemId);
    if(solutionItemId){
        currentSolutionItem = items.find(item => item.id == solutionItemId);
    }else{
        currentSolutionItem = null;
    }
    console.log("try get solutionItem.",solutionItemId,currentSolutionItem);
}

//上移条目：检查是否有上一条，如果没有则返回
function moveupSolutionItem(){
    getCurrentSolutionItem();
    if(currentSolutionItem){
        var currentSolutionItemIndex = (items|| []).findIndex((item) => item.id === currentSolutionItem .id); //找到当前条目在items的下标
        if(currentSolutionItemIndex > 0){
            var preSolutionItem = items[currentSolutionItemIndex-1];
            swapSolutionItem(currentSolutionItem.id, preSolutionItem.id);
        }
    }else{
        console.log("failed moveup.",solutionItemId,currentSolutionItem);
    }
}

//下移条目：检查是否有下一条，如果没有则返回
function movedownSolutionItem(){
    getCurrentSolutionItem();
    if(currentSolutionItem){
        var currentSolutionItemIndex = (items|| []).findIndex((item) => item.id === currentSolutionItem .id); //找到当前条目在items的下标
        if(currentSolutionItemIndex < items.length-1){
            var postSolutionItem = items[currentSolutionItemIndex+1];
            swapSolutionItem(currentSolutionItem.id, postSolutionItem.id);
        }
    }else{
        console.log("failed movedown.",solutionItemId,currentSolutionItem);
    }
}

//上移、下移：仅在有两个条目时发生，第一条不能上移，最后一条不能下移
function swapSolutionItem(solutionItemId1, solutionItemId2){
    console.log("try to swap solution item info.",solutionItemId1, solutionItemId2);
    $.ajax({
        url:app.config.sx_api+"/diy/solution/rest/swap/"+solutionItemId1+"/"+solutionItemId2,
        type:"POST",
        data:JSON.stringify({}),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===swap solution item done===\n",ret);
            if(ret.success){ //取消浮框，并更新界面
                //直接刷新页面
                window.location.href = "solution-modify.html?id="+solution.id;
            }else{
              siiimpleToast.message('啊哦，出错了~~',{
                      position: 'bottom|center'
                    });    
            }
        }
    });
}

//删除一个条目
function deleteSolutionItem(){
    console.log("try to delete solution item info.",solutionItemId);
    $.ajax({
        url:app.config.sx_api+"/diy/solution/rest/solutionItem/ignore/"+solutionItemId,
        type:"POST",
        data:JSON.stringify({}),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===delete solution item done===\n",ret);
            if(ret.success){ //取消浮框，并更新界面
                //直接刷新页面
                window.location.href = "solution-modify.html?id="+solution.id;
            }else{
              siiimpleToast.message('啊哦，出错了~~',{
                      position: 'bottom|center'
                    });    
            }
        }
    });
}

//删除一个关联的商品
function deleteStuffItem(solutionitemId, itemKey){
    solutionItemId = solutionitemId;
    console.log("try to delete stuff from solution item.",solutionItemId, itemKey);
    getCurrentSolutionItem();

    //直接替换当前solutionItem的关联商品集合
    var stuffItems = [];
    if(currentSolutionItem.itemIds){
        stuffItems = currentSolutionItem.itemIds.replace(/\s+/g,"").split(",");
        var idx = stuffItems.indexOf(itemKey);
        if(idx>-1)
            stuffItems.splice(idx,1);
        currentSolutionItem.itemIds = stuffItems.join(",");
    }
    console.log("try to save solution item info.",currentSolutionItem);
    $.ajax({
        url:app.config.sx_api+"/diy/solution/rest/solutionItem/"+solution.id,
        type:"post",
        data:JSON.stringify(currentSolutionItem),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===save solution item done===\n",ret);
            if(ret.success){ //取消浮框，并更新界面
                //直接刷新页面
                window.location.href = "solution-modify.html?id="+solution.id;
            }else{
              siiimpleToast.message('啊哦，出错了~~',{
                      position: 'bottom|center'
                    });    
            }
        }
    });
}

//保存solutionItem信息
function saveSolutionItemInfo(solutionItem){
    console.log("try to save solution item info.",solutionItem);
    $.ajax({
        url:app.config.sx_api+"/diy/solution/rest/solutionItem/"+solution.id,
        type:"post",
        data:JSON.stringify(solutionItem),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },  
        success:function(ret){
            console.log("===save solution item done===\n",ret);
            if(ret.success){ //取消浮框，并更新界面
                //直接刷新页面
                window.location.href = "solution-modify.html?id="+solution.id;
            }else{
              siiimpleToast.message('啊哦，出错了~~',{
                      position: 'bottom|center'
                    });    
            }
        }
    });
}

//加载选定主题下的type信息，用于选择区分
var subtypes=[];//装载当前主题下的subtype
function loadSubtypes(){
    console.log("try to load solution subtype info.",solution.scheme.id);
    $.ajax({
        url:app.config.sx_api+"/diy/proposalSubtype/rest/subtypes/"+solution.scheme.id,
        type:"get",
        success:function(ret){
            console.log("===got subtypes===\n",ret);
            subtypes = ret;

            //添加section作为第一个元素
            subtypes.unshift({
                id:"section",//固定为section，用于区分
                name: "分隔符",
                logo: "https://www.biglistoflittlethings.com/static/logo/distributor/ilife.png",
                description: "条目分隔符"
            });

            //默认不装载，仅在选中条目时根据具体类型完成加载
        }
    });
}
//选中条目或新增条目时显示subtype logo
function showSubtypeLogo(currentType){  
    console.log("try show subtype logos.",currentType,subtypes);
    $("#subtypeLogo").empty();//先清空之前的内容
    //装载options：
    subtypes.forEach(function(subtype){
        var selected  = subtype.id==currentType?"selected":"";
        $("#subtypeLogo").append('<option data-img-src="'+subtype.logo+'" data-img-alt="'+subtype.name+'" value="'+subtype.id+'" '+selected+'>  '+subtype.name+'  </option>');
    });
    //显示组件：
    $("#subtypeLogo").imagepicker({
          hide_select : true,
          show_label  : true,
          changed: function(select, newvalues, oldvalues, event){
            console.log("item changed..newvalues.",newvalues);
            if(!currentSolutionItem.type)currentSolutionItem.type={};
            currentSolutionItem.type["id"] = newvalues[0];//设置logo
          }
        });
}

//构建方案条目html：根据类型显示具体内容。section类型仅显示分隔信息
//显示左侧为圆形 type logo，右侧为名称、描述、tags列表。分行显示。并包含有商品条目div
var btnStyle = "border:1px solid orange;padding:2px 5px;font-size:10px;border-radius:5px;margin:2px;min-width:32px;text-align:center;"
var btnStyleS = "border:1px solid orange;padding:2px 5px;font-size:10px;border-radius:5px;margin:2px;min-width:24px;text-align:center;"
var btnStyleL = "border:1px solid orange;padding:2px 5px;font-size:10px;border-radius:5px;margin:2px;min-width:48px;text-align:center;"
function buildSolutionItemHtml(item){
    //如果type为section则显示分隔符。仅显示标题和描述。
    if(!item.type || "section"==item.type.id){
        var  html = '<div style="width:100%;">';
            html += '<div class="board-item-tips-seperator"></div> ';
            if(item.name && item.name.trim().length>0)
                html += '<div class="board-item-tips" style="font-size:14px;line-height:18px;width:80%;">'+item.name+'</div> '
            if(item.description && item.description.trim().length>0)
                html += '<div class="board-item-tips" style="line-height:14px;">'+item.description+'</div> '
            html += '<div style="width:100%;text-align:center;display:flex;flex-direction:row;justify-content: center;">';
                html += '<div id="moveupItemBtn'+item.id+'" data-solutionitemid="'+item.id+'" style="'+btnStyleS+'">上移</div>';
                html += '<div id="movedownItemBtn'+item.id+'"  data-solutionitemid="'+item.id+'" style="'+btnStyleS+'">下移</div>';
                html += '<div id="deleteItemBtn'+item.id+'"  data-solutionitemid="'+item.id+'" style="'+btnStyleS+'">删除</div>';
                html += '<div id="modifyItemBtn'+item.id+'"  data-solutionitemid="'+item.id+'" style="'+btnStyleS+'">修改</div>';
                html += '<div id="createItemBtn'+item.id+'"  data-solutionitemid="'+item.id+'" style="'+btnStyleL+'">增加条目</div>';
            html += '</div>';

            html += '<div class="board-item-tips-seperator"></div>';
        html += '</div">';


        return html
    }

    //否则显示普通条目
    var logo = "https://www.biglistoflittlethings.com/static/logo/distributor/ilife.png";
    if(item.type && item.type.logo){
        logo = item.type.logo;
    }

    var image = "<img src='"+logo.replace(/\.avif/g,"")+"' style='width:60px;object-fit:cover;/*border-radius:50%;*/'/>";
    var title = "<div class='title' style='margin-left:0;font-size:14px;'>"+item.name+"</div>";
    var tags = "<div>";
    if(item.tags && item.tags.trim().length>0 && item.tags.split(" ").length>0){//装载标签
        item.tags.split(" ").forEach(function(tag){
            if(tag&&tag.trim().length>0)
                tags += "<span style='border-radius:10px;background-color:#514c49;color:#fff;padding:2px 5px;margin-right:2px;font-size:10px;line-height:12px;'>"+tag+"</span>";
        });
    }
    tags += "</div>";
    var description = "<div class='description'>"+item.description+"</div>";
    var stuffDiv = "<div id='stuffItemDiv"+item.id+"'></div>";

    var btnHtml = '<div style="width:100%;text-align:center;display:flex;flex-direction:row;">';
            btnHtml += '<div id="moveupItemBtn'+item.id+'" data-solutionitemid="'+item.id+'" style="'+btnStyleS+'">上移</div>';
            btnHtml += '<div id="movedownItemBtn'+item.id+'"  data-solutionitemid="'+item.id+'" style="'+btnStyleS+'">下移</div>';
            btnHtml += '<div id="deleteItemBtn'+item.id+'"  data-solutionitemid="'+item.id+'" style="'+btnStyleS+'">删除</div>';
            btnHtml += '<div id="modifyItemBtn'+item.id+'"  data-solutionitemid="'+item.id+'" style="'+btnStyleS+'">修改</div>';
            btnHtml += '<div id="createItemBtn'+item.id+'"  data-solutionitemid="'+item.id+'" style="'+btnStyleL+'">增加条目</div>';
            btnHtml += '<div id="addStuffBtn'+item.id+'"  data-solutionitemid="'+item.id+'" data-keyword="'+item.name+'" style="'+btnStyleL+'">关联商品</div>';
        btnHtml += '</div>';

    var html = "<div class='task' id='solutionItem"+item.id+"'><div class='task-logo'>" + image +"</div><div class='task-tags'>" + title + tags + description+btnHtml +stuffDiv+"</div>"
    return html;
      
}

//构建商品条目html。参数：
//solutionItemId 所属方案条目
//item 商品条目doc
function buildStuffItemHtml(solutionItemId, item){
    var logo = "https://www.biglistoflittlethings.com/static/logo/distributor/ilife.png";
    if(item.logo){
        logo = item.logo.replace(/\.avif/,"");
    }else{
        logo = item.images[0].replace(/\.avif/,"");
    }

    var btnHtml = '<span id="deleteStuffBtn'+item._key+'" data-solutionitemid="'+solutionItemId+'"  data-itemkey="'+item._key+'" style="'+btnStyle+'">删除</span>';

    var highlight = "<div class='description'>"+(item.price.currency?item.price.currency:"￥")+item.price.sale+" "+item.distributor.name+btnHtml+"</div>";
    var title = "<div class='description' style='line-height: 14px; overflow: hidden; text-overflow: ellipsis;display: -webkit-box;-webkit-line-clamp: 3;-webkit-box-orient: vertical;'>"+item.title+"</div>";
    var image = "<img src='"+logo+"' style='width:32px;object-fit:cover;border-radius:5px;margin:5px auto;'/>";

    var html = "<div id='stuffItem"+item._key+"' class='task'><div class='task-logo' style='text-align:left;/*vertical-align:bottom;*/width:12%;'>" + image +"</div><div class='task-tags'>" +highlight+title+"</div>"
    return html;   
}

//构建同主题方案条目：包含logo 、name、description
function buildSolutionHtml(item){
    //默认随机指定logo
    var logo = "https://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg";
    if(item.logo && item.logo.trim().length>0){
        logo = item.logo;
    }

    var tagReadme = "<span id='reader-readme-"+item.openid+"' class='highlight-tag'></span>";
    var tagReadta = "<span id='reader-readta-"+item.openid+"' class='highlight-tag'></span>";
    var tagReadBtn = "<span id='reader-btn-"+item.openid+"' class='action-tag'></span>";

    var reader = "<div class='title readerDiv'><div class='readerName'>"+(item.nickname?item.nickname.replace(/undefined/g,''):'')+"</div><div class='readtaBtn'>"+ tagReadBtn+"</div></div>";
    var title = "<div class='description'>"+item.articleTitle+"</div>";
    var image = "<img src='"+logo+"' style='width:60px;object-fit:cover;border-radius:50%;'/>";
    var description = "<div class='description readerCountDiv'><div class='readTimestamp'>"+item.ts+"</div><div class='readCount'>"+tagReadme+tagReadta+"</div></div>";

    var seperator = "";
    if(num>1)
        seperator = "<div class='item-separator' style='border-radius:0'></div>";
    $("#waterfall").append("<li>"+seperator+"<div class='task' data='"+item.eventId+"' data-reader='"+item.openid+"'><div class='task-logo'>" + image +"</div><div class='task-tags'>" +reader +description + title+"</div></li>");
    num++;    
}

//将solution内容显示到页面
function showContent(solution){
    //标题
    console.log("display edit button.[current user id]"+app.globalData.userInfo._key+"[solution user id]"+solution.byOpenid);
    if(app.globalData.userInfo && app.globalData.userInfo._key == solution.byOpenid){//如果是当前达人则可以直接修改
        $("#title").html(
            '<div id="solutionName">'+solution.name+'</div>' 
            + '<div id="modifySolutionBtn" data-name="'+solution.name+'"  data-desc="'+solution.description+'" style="'+btnStyleS+'">修改</div>'
            //+ '<div id="createSolutionItemBtn" style="'+btnStyleL+'">增加条目</div>'
            //+"&nbsp;<a style='color:#E16531;display:inline;font-size:12px;' href='#' id='btnPush'>云推送</a>"
            //+"&nbsp;<a style='color:#006cfd;display:inline;font-size:12px;' href='solution-modify.html?id="+solution.id+"'>修改</a>"
            );
    }else if(app.globalData.userInfo && app.globalData.userInfo._key){//如果不是编辑达人，则先克隆后再需改
        $("#title").html(
            '<div id="solutionName">'+solution.name+'</div>' 
            + '<div id="modifySolutionBtn" data-name="'+solution.name+'"  data-desc="'+solution.description+'" style="'+btnStyleS+'">修改</div>'
            //+ '<div id="createSolutionItemBtn" style="'+btnStyleL+'">增加条目</div>'
            //+"&nbsp;<a style='color:#E16531;display:inline;font-size:12px;' href='#' id='btnPush'>云推送</a>"
            //+"&nbsp;<a style='color:#006cfd;display:inline;font-size:12px;' id='cloneBoardBtn'>克隆</a>"
            );
        $("#cloneBoardBtn").click(function(){
            console.log("try to clone board.[solution]"+solution.id+"[openid]"+app.globalData.userInfo._key);
            util.AJAX(app.config.sx_api+"/diy/solution/rest/clone/"+solution.id, function (res) {
                console.log("clone broker successfully.",res);
                    if(res.success && res.solution && res.solution.id){
                        //跳转到编辑界面
                        window.location.href = "solution-modify.html?id="+res.solution.id;                       
                    }else{
                        siiimpleToast.message('啊哦，出错了~~',{
                              position: 'bottom|center'
                            });                        
                    }
 
            },"POST",{
                byOpenid:app.globalData.userInfo._key,
                forOpenid:app.globalData.userInfo._key,
                byNickname:app.globalData.userInfo.nickname,
                forNickname:app.globalData.userInfo.nickname                
            },{ "Content-Type":"application/json" });            
        });
    }else{//普通用户则只显示标题
        $("#title").html(
            '<div id="solutionName">'+solution.name+'</div>' 
            + '<div id="modifySolutionBtn" data-name="'+solution.name+'"  data-desc="'+solution.description+'" style="'+btnStyleS+'">修改</div>'
            //+ '<div id="createSolutionItemBtn" style="'+btnStyleL+'">增加条目</div>'
            );
    }

    //注册事件
    $("#solutionName2").val(solution.name);
    $("#solutionDesc2").val(solution.description);
    $("#modifySolutionBtn").click(function(){
        showSolutionInfoForm(); 
    });
    $("#createSolutionItemBtn").click(function(){
        showCreateSolutionItemInfoForm(); 
    });    
    
    //作者与发布时间
    $("#author").html(solution.byNickname?solution.byNickname:"");    //默认作者为board创建者
    $("#publish-time").html(solution.updateDate.split(" ")[0]);   

    //摘要
    $("#content").html(solution.description);

    //分享链接
    if(posterId){//如果指定海报ID
        $("#share-link").attr("href","board2-poster.html?type=board2-waterfall&id="+id+"&posterId="+posterId);
    }else{
        $("#share-link").attr("href","board2ext.html?type=board2-waterfall&id="+id);
    }

    //检查并修改分享者为fromBroker
    //如果带有fromBroker，则加载对应达人并显示到作者。注意：仅修改显示，不修改broker信息
    if(fromBroker && fromBroker.trim().length>0){//根据分享者加载对应达人
        loadBrokerById(fromBroker);
    }  

    //注册事件：云推送
    $("#btnPush").click(function(){
        event.stopPropagation();//阻止触发跳转详情

        //检查商品条目数量，少于3条不推送
        if(items.length<3){
            console.log("no enough board items. ignore.");
            siiimpleToast.message('至少要有3个商品，请添加~~',{
              position: 'bottom|center'
            });             
        }else{
            //推送到CK，同步发送到微信群
            wxGroups.forEach(function(wxgroup){
                saveFeaturedItem(getUUID(), broker.id, "wechat", wxgroup.id, wxgroup.name, "solution", solution.id, JSON.stringify(solution), "pending");
            });   
            if(wxGroups.length>0){
                console.log("wxgroups synchronized.");
                siiimpleToast.message('推送已安排~~',{
                  position: 'bottom|center'
                });             
            }else{
                console.log("no wxGroups.");
                siiimpleToast.message('还未开通云助手，请联系客服~~',{
                  position: 'bottom|center'
                });          
            }
        }

    });  
}

function showShareContent(){
    var strBonus = "";
    if(bonusMin>0){
        strBonus += "返￥"+(parseFloat(new Number(bonusMin).toFixed(1))>0?parseFloat(new Number(bonusMin).toFixed(1)):parseFloat(new Number(bonusMin).toFixed(2)));
    }
    if(bonusMax>0 && bonusMax > bonusMin){
        strBonus += "-"+parseFloat(Number(bonusMax).toFixed(1));
    }else if(bonusMin>0){
        strBonus += " 起";
    }else{
        strBonus += "推广积分";
    }
    //console.log("try update bouns.",strBonus);
    $("#share-bonus").html(strBonus);
    //默认隐藏，仅对达人开放显示
    if(broker && broker.id){
        $("#share-bonus").toggleClass("share-bonus",true);
        $("#share-bonus").toggleClass("share-bonus-hide",false);
    }else{
        $("#share-bonus").toggleClass("share-bonus",false);
        $("#share-bonus").toggleClass("share-bonus-hide",true);
    }
    /*
    if(strBonus.length > 0){//显示佣金
        $("#share-bonus").html("返￥"+strBonus);
        $("#share-bonus").toggleClass("share-bonus",true);
        $("#share-bonus").toggleClass("share-bonus-hide",false);  
    }else{
       $("#share-bonus").toggleClass("share-bonus",false);
       $("#share-bonus").toggleClass("share-bonus-hide",true);        
    }
    //**/
}

//根据openid查询加载broker
function loadBrokerByOpenid(openid) {
    //console.log("try to load broker info by openid.[openid]",openid);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokerByOpenid/"+openid, function (res) {
        console.log("load broker info.",openid,res);
        if (res.status) {//将佣金信息显示到页面
            broker = res.data;
            loadWxGroups(res.data.id);//加载该达人的微信群
            //$("#author").html(broker.nickname);    //如果当前用户是达人，则转为其个人board     
            $("#sharebox").css("display","block");      //仅对达人显示分享框
        }
        //加载达人后再注册分享事件：此处是二次注册，避免达人信息丢失。
        registerShareHandler();       
    });
}

//根据达人ID加载活跃微信群
var wxGroups = [];//存储当前达人的微信群列表
function loadWxGroups(brokerId){
    console.log("try to load wx groups by brokerId.",brokerId);
    $.ajax({
        url:app.config.sx_api+"/wx/wxGroup/rest/listByBrokerId?brokerId="+brokerId,
        type:"get",        
        success:function(ret){
            console.log("===got wx groups===\n",ret);
            wxGroups = ret;
        }
    }); 
}
//存储featured item到ck
function saveFeaturedItem(eventId, brokerId, groupType, groupId, groupName,itemType, itemKey, jsonStr, status){
  var q = "insert into ilife.features values ('"+eventId+"','"+brokerId+"','"+groupType+"','"+groupId+"','"+groupName+"','"+itemType+"','"+itemKey+"','"+jsonStr.replace(/'/g, "’")+"','"+status+"',now())";
  console.log("try to save featured item.",q);
  jQuery.ajax({
    url:app.config.analyze_api+"?query=",//+encodeURIComponent(q),
    type:"post",
    data:q,
    headers:{
        "content-type": "text/plain; charset=utf-8", // 直接提交raw数据
        "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
    },         
    success:function(json){
      console.log("===featured item saved.===\n",json);
    }
  });    
}


//根据id查询加载broker
function loadBrokerById(brokerId) {
    //console.log("try to load broker info by id.[brokerId]",brokerId);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokerById/"+brokerId, function (res) {
        console.log("load broker info.",brokerId,res);
        if (res.status) {//将佣金信息显示到页面
            //$("#author").html(res.data.nickname);    //如果当前用户是达人，则转为其个人board           
        }
        //加载达人后再注册分享事件：此处是二次注册，避免达人信息丢失。
        registerShareHandler();
    });
}

//根据id查询solution详情
function loadSolution(solutionId){
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };     
    util.AJAX(app.config.sx_api+"/diy/solution/rest/solution/"+solutionId, function (res) {
        console.log("load solution successfully.", res)
        if(res.success && res.data){
            console.log("got solution info.", res)
            solution = res.data;
            showContent(res.data);

            loadSubtypes();//加载子类型清单

            //注册事件：根据关键词搜索更多
            $("#jumpToSearch").click(function(){
                window.location.href="index.html?keyword="+solution.name;
            });            

            //准备注册分享事件。需要等待内容加载完成后才注册
            //判断是否为已注册用户
            if(app.globalData.userInfo&&app.globalData.userInfo._key){//表示是已注册用户
                loadBrokerByOpenid(app.globalData.userInfo._key);
                //注意：在加载完成后会注册分享事件，并用相应的broker进行填充
            }else{//直接注册分享分享事件，默认broker为system，默认fromUser为system
                console.log("cannot get user info. assume he is a new one.");
                //TODO:是不是要生成一个特定的编号用于识别当前用户？在注册后可以与openid对应上
                //检查cookie是否有标记，否则生成标记
                tmpUser = $.cookie('tmpUserId');
                if(tmpUser && tmpUser.trim().length>0){
                    console.log("there already has a temp code for this user.", tmpUser);
                }else{
                    tmpUser = "tmp-"+gethashcode();
                    console.log("there is no temp code for this user, generate one.", tmpUser);
                    $.cookie('tmpUserId', tmpUser, { expires: 3650, path: '/' });  
                }
                registerShareHandler();
            }            

        }
    }, "GET",{},header);
}


//根据solutionId查询所有条目列表
function loadSolutionItems(solutionId){
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };     
    util.AJAX(app.config.sx_api+"/diy/solution/rest/items/"+solutionId, function (res) {
        console.log("load solution items successfully.", res)
        //装载具体条目
        var hits = res.data;
        for(var i = 0 ; hits && i < hits.length ; i++){
            //将solutionItem显示到界面
            var html = buildSolutionItemHtml(hits[i]);
            $("#items").append(html);

            //放入items列表用于排序及编辑支持
            items.push(hits[i]);

            //注册操作事件
            $("#moveupItemBtn"+hits[i].id).click(function(){
                //先设置当前item条目
                if($(this).data("solutionitemid") && $(this).data("solutionitemid").trim().length>0)
                    solutionItemId = $(this).data("solutionitemid")
                moveupSolutionItem(); 
            });
            $("#movedownItemBtn"+hits[i].id).click(function(){
                //先设置当前item条目
                if($(this).data("solutionitemid") && $(this).data("solutionitemid").trim().length>0)
                    solutionItemId = $(this).data("solutionitemid")
                movedownSolutionItem(); 
            });            
            $("#deleteItemBtn"+hits[i].id).click(function(){
                //先设置当前item条目
                if($(this).data("solutionitemid") && $(this).data("solutionitemid").trim().length>0)
                    solutionItemId = $(this).data("solutionitemid")
                deleteSolutionItem(); 
            });  
            $("#modifyItemBtn"+hits[i].id).click(function(){
                //先设置当前item条目
                if($(this).data("solutionitemid") && $(this).data("solutionitemid").trim().length>0)
                    solutionItemId = $(this).data("solutionitemid")
                showModifySolutionItemInfoForm(); 
            });    
            $("#createItemBtn"+hits[i].id).click(function(){
                //先设置当前item条目
                if($(this).data("solutionitemid") && $(this).data("solutionitemid").trim().length>0)
                    solutionItemId = $(this).data("solutionitemid")
                showCreateSolutionItemInfoForm(); 
            });                      
            $("#addStuffBtn"+hits[i].id).click(function(){
                window.location.href="index.html?solutionId="+solution.id+"&solutionItemId="+ $(this).data("solutionitemid")+"&keyword="+ $(this).data("keyword");
            });  
            //装载关联的stuff条目
            loadStuffItem(hits[i]);//查询具体的item条目
            //如果第一个item为section类型则隐藏默认分隔条
            if(i==0 && (!hits[i].type || "section"==hits[i].type.id)){
                $("#defaultSection").css("display","none");
            }            
        }        
    }, "GET",{},header);
}

//根据方案条目获取关联的商品条目，并逐条加载显示到界面
function loadStuffItem(item){//获取内容列表
    if(item && item.itemIds && item.itemIds.trim().length>0){ //items是逗号分隔的字符串，需要分解后逐条加载
        console.log("try load stuff items.", item.itemIds.split(","),item.itemIds)
        item.itemIds.split(",").forEach(function(_key){
            var itemKey = _key.replace(/\s+/,"");
            console.log("try load stuff item.", _key, itemKey)
            $.ajax({
                url:"https://data.shouxinjk.net/_db/sea/my/stuff/"+itemKey,
                type:"get",
                data:{},
                success:function(data){  
                    console.log("got stuff",data);
                    insertStuffItem(item.id, data); //显示到界面    
                }
            })  
        });
    }          
}

//将方案条目下关联的商品条目显示到界面
function insertStuffItem(solutionItemId, stuff){
    // 获取佣金：获取范围
    //console.log("Board::insertBoardItem load share info.", item);
    if(stuff.profit && stuff.profit.order && stuff.profit.order >0){
        //console.log("Board::insertBoardItem load share info. step 2...", item);
        if( bonusMax == 0 & bonusMin ==0 ){//首先将两者均设为第一个值
            bonusMin = stuff.profit.order;
            bonusMax = stuff.profit.order;
        }
        if( stuff.profit.order > bonusMax){
            bonusMax = stuff.profit.order;
        }
        if( stuff.profit.order < bonusMin){
            bonusMin = stuff.profit.order;
        }
        //showShareContent();//当前无佣金时也显示
    }   
    showShareContent();//更新佣金

    var html = buildStuffItemHtml(solutionItemId, stuff);
    $("#stuffItemDiv"+solutionItemId).append(html);

    //注册删除事件
    $("#deleteStuffBtn"+stuff._key).click(function(){
        solutionItemId = $(this).data("solutionitemid")
        var itemKey = $(this).data("itemkey");
        console.log("trigger delete stuff item.",solutionItemId,itemKey);
        deleteStuffItem(solutionItemId, itemKey);
    });

    //注册事件：能够跳转到指定item
    /**
    $('#stuffItem'+stuff._key).click(function(){
        var targetUrl = "info2.html?id="+stuff._key;
        //根据是否是海报进入区分跳转：如果是海报进入则直接跳转到第三方页面
        if(posterId&&!stuff.link.token){//对于淘宝等还是要进入详情页面，可以直接复制淘口令
            targetUrl = "go.html?id="+stuff._key;
        }
        if(broker&&broker.id){//如果当前用户是达人，则使用当前达人跟踪。
            targetUrl += "&fromBroker="+broker.id;
        }else if(board&&board.broker.id){//否则，使用board的创建者进行跟踪
            targetUrl += "&fromBroker="+board.broker.id;
        }
        window.location.href=targetUrl;
    });
    //**/

    // 表示加载结束
    loading = false;
}


function loadCategories(currentCategory){
    $.ajax({
        url:app.config.sx_api+"/mod/channel/rest/channels/active",
        type:"get",
        success:function(msg){
            var navObj = $(".navUl");
            for(var i = 0 ; i < msg.length ; i++){
                navObj.append("<li data='"+msg[i].id+"'>"+msg[i].name+"</li>");
                if(currentCategory == msg[i].id)//高亮显示当前选中的category
                    $(navObj.find("li")[i]).addClass("showNav");
            }
            //注册点击事件
            navObj.find("li").click(function(){
                var key = $(this).attr("data");
                //跳转到首页
                window.location.href = "index.html?category="+key;
            })
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
    var shareUrl = window.location.href.replace(/board2-waterfall/g,"share");//需要使用中间页进行跳转
    if(shareUrl.indexOf("?")>0){//如果本身带有参数，则加入到尾部
        shareUrl += "&fromUser="+shareUserId;
        shareUrl += "&fromBroker="+shareBrokerId;
    }else{//否则作为第一个参数增加
        shareUrl += "?fromUser="+shareUserId;
        shareUrl += "&fromBroker="+shareBrokerId;        
    }
    shareUrl += "&origin=board-waterfall";//添加源，表示是一个列表页分享

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
                    title:board&&board.title?board.title:"小确幸，大生活", // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:board.logo?board.logo:"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg", // 分享图标
                    success: function () {
                        // 用户点击了分享后执行的回调函数
                        //TODO: board分享当前不记录
                        /*
                        logstash(stuff,"mp","share timeline",shareUserId,shareBrokerId,function(res){
                            console.log("分享到朋友圈",res);
                        }); 
                        //**/
                    },
                });
                //分享给朋友
                wx.onMenuShareAppMessage({
                    title:board&&board.title?board.title:"小确幸，大生活", // 分享标题
                    desc:board.description&&board.description.trim().length>0?board.description.replace(/<br\/>/g,""):"Live is all about having a good time.", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: board.logo?board.logo:"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg", // 分享图标
                    type: 'link', // 分享类型,music、video或link，不填默认为link
                    dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
                    success: function () {
                      // 用户点击了分享后执行的回调函数
                      //TODO:board分享当前不记录
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
