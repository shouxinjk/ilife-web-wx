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
    if(args["id"]){
        boardId = args["id"]; //必须传递boardId
    }

    $('#waterfall').NewWaterfall({
        width: columnWidth,
        delay: 100,
    });    

    $("body").css("background-color","#fff");//更改body背景为白色

    loadPerson(currentPerson);//加载用户
    loadBoard(boardId);//加载board
    loadItems(boardId);//加载board items

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });

    //注册事件：board操作
    $("#submitBtn").click(function(){
        updateBoard();
    });
    $("#deleteBtn").click(function(){//取消则返回board列表界面
        window.location.href="boards.html";
    });   
    $("#addMoreItemBtn").click(function(){
        window.location.href="index.html?boardId="+boardId;
    });   

});

util.getUserInfo();//从本地加载cookie

var debug = false;

var logo = "https://www.biglistoflittlethings.com/list/images/logo.jpeg";//board logo 默认值
var boardLogoNames = [];
var boardLogoUrls = [];

var columnWidth = 800;//默认宽度600px
var columnMargin = 5;//默认留白5px
var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var items = [];//所有条目列表
var page = {
    size:20,//每页条数
    total:1,//总页数
    current:-1//当前翻页
};

var currentActionType = '';//当前操作类型
var tagging = '';//操作对应的action 如buy view like 等

var currentPerson = app.globalData.userInfo?app.globalData.userInfo._key:null;
var userInfo=app.globalData.userInfo;//默认为当前用户

var currentPersonaId = "none";
var currentPersona = {};

var currentBrokerId = null;
var boardId = null;
var board = {};//存储当前编辑board

var btnStyle = "border:1px solid orange;padding:2px 5px;font-size:10px;border-radius:5px;margin:2px;min-width:32px;text-align:center;"
var btnStyleS = "border:1px solid orange;padding:2px 5px;font-size:10px;border-radius:5px;margin:2px;min-width:24px;text-align:center;"
var btnStyleL = "border:1px solid orange;padding:2px 5px;font-size:10px;border-radius:5px;margin:2px;min-width:48px;text-align:center;"

var boardItemFormTemplate = 
        '<div class="board-item-form" id="boardItemDiv__itemid" style="margin-top:5px;">'+ 
            '<span id="deleteItemBtn__itemid"  data-boarditemid="__itemid" style="'+btnStyleL+'">删除</span>' +    
            '<span id="modifyItemBtn__itemid"  data-boarditemid="__itemid" style="'+btnStyleL+'">修改</span>' +                   
        '</div>';

//修改board：注意同时修改board信息以及board列表描述内容
function updateBoard(personaId){
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };     
    /**
    var data = {
        title:$("#boardTitle").val(),
        logo:logo,//采用已经保存的值传递
        description:$("#boardDescription").val(),
        //tags:$("#boardTags").val(),
        poster:JSON.stringify(board.poster),
        article:JSON.stringify(board.article),
        tags:$("#boardKeywords").val(),//tags直接用keywords
        keywords:$("#boardKeywords").val()
    };
    //**/
    var data_str = JSON.stringify(board);//重要：避免影响board数据，通过转换后建立新的对象
    var data = JSON.parse(data_str);
    data.poster = JSON.stringify(board.poster);
    data.article = JSON.stringify(board.article);
    data.title = $("#boardTitle").val();
    data.logo = logo;
    data.description = $("#boardDescription").val();
    data.tags = $("#boardKeywords").val();//tags直接用keywords
    data.keywords = $("#boardKeywords").val();
    data.byOpenid = app.globalData.userInfo._key;
    data.byNickname = app.globalData.userInfo.nickname;
    if(currentBrokerId && currentBrokerId.trim().length>0){
        data.broker = {
            id: currentBrokerId
        }
    }

    util.AJAX(app.config.sx_api+"/mod/board/rest/board/"+boardId, function (res) {
        console.log("Broker::Board::UpdateBoard modify board successfully.", res)
        if(res.status){
            console.log("try index board.");
            indexBoardDoc();
        }
    }, "PUT",data,header);
}


//提交索引。将整个文档提交ES建立所以，便于检索
function indexBoardDoc(){
    var tags = [];
    if(board.tags && board.tags.trim().length>0){
        board.tags.split(" ").forEach(function(tag){
            if(tag&&tag.trim().length>0)
                tags.push(tag.trim());
        });
    }
    var logo = "http://www.biglistoflittlethings.com/static/logo/distributor/ilife.png";
    if(board.logo && board.logo.trim().length>0)
      logo = board.logo;
    var doc = {
        type: "board", //固定为board
        scheme: "board",//直接以board类型填充
        itemkey: board.id,   
        name: board.title,
        description: board.description, 
        tags: tags,              
        logo: logo,
        //author: broker?broker.nickname:app.globalData.userInfo.nickname,
        author: app.globalData.userInfo.nickname,
        timestamp: new Date()
    }    
    console.log("try to index board doc.",doc,JSON.stringify(doc));
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
        success:function(res){
            console.log("Broker::Board::UpdateBoard now jump to home page for item adding.", res)
            $.cookie('board', null,{ path: '/' });  //保存后从cookie里删除修改状态的board：注意需要和创建时保持路径一致
            window.location.href = "boards.html";//跳转到boards列表
            //window.location.href = "board2.html?id="+boardId;//跳转到board查看界面
        }
    })     
}


//修改boardItem
function updateBoardItem(item){
    console.log("Broker::Board::UpdateBoardItem try to update board item.", item)
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };     
    var data = {
        title:item.title,
        description:item.description
    };
    util.AJAX(app.config.sx_api+"/mod/boardItem/rest/board-item/"+item.id, function (res) {
        console.log("Broker::Board::UpdateBoardItem modify board item successfully.", res)
        if(res.status){
            console.log("Broker::Board::UpdateBoardItem now jump to board modify page for editing.", res)
            //更新当前页面数据即可
            $("#itemTitleDiv"+item.id).html(item.title);
            $("#itemDescDiv"+item.id).html(item.description);
            //关闭浮框
            $.unblockUI(); //直接取消即可
            siiimpleToast.message('已修改~~',{
                  position: 'bottom|center'
                });              
            //window.location.href = "boards-modify.html?id="+res.data.board.id;//跳转到board查看界面
        }
    }, "PUT",data,header);
}

//删除指定boardItem
function deleteBoardItem(item){
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };     
    util.AJAX(app.config.sx_api+"/mod/boardItem/rest/board-item/x/"+item.id, function (res) {
        console.log("Broker::Board::UpdateBoardItem modify board item successfully.", res)
        if(res.status){
            console.log("Broker::Board::UpdateBoardItem now jump to board modify page for editing.", res)
            //window.location.href = "boards-modify.html?id="+item.board.id;//跳转到board查看界面
            //删除后直接在页面隐藏元素即可
            $("#boardItemLi"+item.id).empty();
            siiimpleToast.message('已删除~~',{
                  position: 'bottom|center'
                });             

        }
    }, "PUT",{},{});
}

function showLogoSelect(){
    //添加23张默认logo图片到列表：对于没有条目的优先以默认图片
    if(boardLogoUrls.length==0){
        for(var i=1;i<13;i++){
            boardLogoUrls.push("https://www.biglistoflittlethings.com/list/images/logo"+i+".jpeg");
            boardLogoNames.push("系统Logo "+i);
        }
    }    
    //装载options：
    for(var i=0;i<boardLogoUrls.length;i++){
        var selected  = boardLogoUrls[i]==logo?"selected":"";
        $("#boardLogo").append('<option data-img-src="'+boardLogoUrls[i]+'" data-img-alt="'+boardLogoNames[i]+'" value="'+boardLogoUrls[i]+'" '+selected+'>  '+boardLogoNames[i]+'  </option>');
    }
    //显示组件：
    $("#boardLogo").imagepicker({
          hide_select : true,
          show_label  : false,
          changed: function(select, newvalues, oldvalues, event){
            console.log("item changed..newvalues.",newvalues);
            logo = newvalues[0];//设置logo
          }
        });
}

//根据boardId查询board信息
function loadBoard(boardId){
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };     
    util.AJAX(app.config.sx_api+"/mod/board/rest/board/"+boardId, function (res) {
        console.log("Broker::Board::loadBoard load board successfully.", res)
        if(res.status){
            console.log("Broker::Board::loadBoard now insert board info.", res);
            var expDate = new Date();
            expDate.setTime(expDate.getTime() + (15 * 60 * 1000)); // 15分钟后自动失效：避免用户不主动修改            
            $.cookie('board', JSON.stringify(res.data), { expires: expDate, path: '/' });  //把编辑中的board写入cookie便于添加itemload
            board  = res.data;
            //解析article
            try{
                var json = JSON.parse(board.article);//注意是JSON string，需要解析
                board.article = json;
            }catch(err){
                console.log("failed parse board article");
                board.article = {};
            }
            //解析poster
            try{
                var json = JSON.parse(board.poster);//注意是JSON string，需要解析
                board.poster = json;
            }catch(err){
                console.log("failed parse board poster");
                board.poster = {};
            }
            displayBoard(board);
        }
    }, "GET",{},header);
}

//显示board设置。使用board内容填写
function displayBoard(board){
    $("#boardTitle").val(board.title?board.title:"");
    $("#boardDescription").val(board.description?board.description:"");
    //$("#boardTags").val(board.tags?board.tags:"");
    $("#boardKeywords").val(board.keywords?board.keywords:"");
    //添加logo
    if(board.logo){
        logo = board.logo;
    }
}

//根据boardId查询所有item列表
function loadItems(boardId){
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };     
    util.AJAX(app.config.sx_api+"/mod/boardItem/rest/board-items/"+boardId, function (res) {
        console.log("Broker::Board::loadBoardItems load board items successfully.", res)
        //装载具体条目
        var hits = res;
        for(var i = 0 ; i < hits.length ; i++){
            loadItem(hits[i]);//查询具体的item条目
        }    
        //显示logo选择框
        showLogoSelect();    
    }, "GET",{},header);
}


function loadItem(item){//获取内容列表
    $.ajax({
        url:"https://data.shouxinjk.net/_db/sea/my/stuff/"+item.item,
        type:"get",
        async:false,//同步调用，否则无法加载logo
        data:{},
        success:function(data){
            item.stuff = data;//装载stuff到boarditem   
            items.push(item); //装载到列表 
            //检查board是否有logo，如果没有logo则进行设置
            if(!board.logo || board.logo.indexOf("biglistoflittlethings")>0){ //不允许使用默认图片
                if(data.logo){
                    board.logo = data.logo;
                }else{
                    board.logo = data.images[0];
                }
                logo = board.logo;
            }
            insertItem(); //显示到界面    
        }
    })            
}

//将item显示到页面。每一个item提供推荐标题、推荐描述编辑。并展示对应的itemlogo、来源、原始标题及tag
function insertItem(){
    // 加载内容
    var item = items[num-1];
    if(!item)return;

    var logoImg = "images/tasks/board.png";
    if(item.stuff && item.stuff.images && item.stuff.images.length>0){
        logoImg = item.stuff.images[0].replace(/\.avif/,'');//默认用第一张图片做logo
        //作为board候选logo
        boardLogoUrls.push(logoImg);
        boardLogoNames.push("商品Logo "+num);
    }

    //显示所关联stuff内容
    var image = "<img src='"+logoImg+"' width='60' height='60'/>";
    var title = "<div class='board-item-title' id='itemTitleDiv"+item.id+"' style='font-weight:bold;line-height:16px;'>"+(item.title?item.title:item.stuff.title)+"</div>";
    var description = "<div class='board-item-desc' id='itemDescDiv"+item.id+"' style='line-height:16px;'></div>";

    var itemForm =  boardItemFormTemplate
        .replace(/__itemid/g,item.id);        

    $("#waterfall").append("<li id='boardItemLi"+item.id+"'><div class='board-item' data='"+item.id+"'><div class='board-item-logo'>" + image +"</div><div class='board-item-tags'>" +title+ description +itemForm+"</div></div></li>");
    //$("#itemTitleDiv"+item.id).html(item.title?item.title:item.stuff.title);

    //使用已经有的数值填写表单
    //$('#boardItemTitle'+num).val(item.title?item.title:item.stuff.title);
    //默认推荐语优先次序：手动填写的推荐语>自动生成的推荐语>人工标注的tagging；其中自动生成的推荐语如多于一条则随机选择
    var advice = "";
    if(debug)console.log("==got stuff advice==",item.stuff.advice,item.stuff.advice?Object.keys(item.stuff.advice).length>0:false);
    if(item.description&&item.description.trim().length>0){//优先采用手动填写的推荐语
        if(debug)console.log("try get advice from item description.");
        advice = item.description;
    }else if(item.stuff.advice && Object.keys(item.stuff.advice).length>0 ){//如果有advice，则随机采用
        if(debug)console.log("try get advice from stuff adivces.");
        var count = Object.keys(item.stuff.advice).length;
        var random = 0;//默认采用第一条
        if(count>1){//如果是多个则随机采用
            random = new Date().getTime()%count;
        }
        advice = item.stuff.advice[Object.keys(item.stuff.advice)[random]];
    }else if(item.stuff.tagging&&item.stuff.tagging.trim().length>0){//否则采用tagging
        if(debug)console.log("try get advice from stuff tagging.");
        advice = item.stuff.tagging;
    }else if(item.stuff.tags&&item.stuff.tags.length>0){//最后采用tags
        if(debug)console.log("try get advice from stuff tags.");
        advice = item.stuff.tags;
    }else{
        //留空，等着填写
    }
    if(debug)console.log("==got advice==",advice);
    $("#itemDescDiv"+item.id).html(advice);

    //注册事件：显示浮框，修改单个条目
    $('#modifyItemBtn'+item.id).click(function(){
        event.stopPropagation();//阻止触发跳转详情
        //先设置当前item条目
        if($(this).data("boarditemid") && $(this).data("boarditemid").trim().length>0){
            boardItemId = $(this).data("boarditemid")
            console.log("try modify item. ", boardItemId);
            showModifyBoardItemInfoForm(); 
        }else{
            console.log("error occured while click modify btn.");
        }
    });
    //注册事件：能够单独删除
    $('#deleteItemBtn'+item.id).click(function(){
        event.stopPropagation();//阻止触发跳转详情
        if($(this).data("boarditemid") && $(this).data("boarditemid").trim().length>0){
            boardItemId = $(this).data("boarditemid")
            console.log("try delete item. ", boardItemId);
            //准备当前选中条目数据
            getCurrentBoardItem();            
            deleteBoardItem(item);
        }else{
            console.log("error occured while click delete btn.");
        }        
    });
    num++;
    // 表示加载结束
    loading = false;
}


//显示编辑当前条目表单
function showModifyBoardItemInfoForm(){
    console.log("show modify board item form.");  

    //准备当前选中条目数据
    getCurrentBoardItem();

    //填写数据
    $("#boardItemName2").val(currentBoardItem.title);
    $("#boardItemDesc2").val(currentBoardItem.description);

    //显示数据填报表单
    $.blockUI({ message: $('#boarditemform'),
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
    $("#btnCancelBoardItem").click(function(){      
        $.unblockUI(); //直接取消即可
    });
    $("#btnSaveBoardItem").click(function(){//完成阅读后的奖励操作
        //检查输入
        if( !$("#boardItemName2").val() || $("#boardItemName2").val().trim().length ==0 ){
            $("#boardItemName2").val(currentBoardItem.title);
            siiimpleToast.message('名称为必填~~',{
              position: 'bottom|center'
            });                 
        }else if( !$("#boardItemDesc2").val() || $("#boardItemDesc2").val().trim().length ==0 ){
            $("#boardItemDesc2").val(currentBoardItem.description);
            siiimpleToast.message('描述为必填~~',{
              position: 'bottom|center'
            });                 
        }else{
            console.log("try to save item.");
            currentBoardItem.title = $("#boardItemName2").val();
            currentBoardItem.description = $("#boardItemDesc2").val();
            updateBoardItem(currentBoardItem);
        }
    });
}

//重新设置当前BoardItem
var boardItemId = null; //当前修改的条目ID
var currentBoardItem = null; //当前修改的条目 obj
function getCurrentBoardItem(){
    console.log("try get boardItem.",boardItemId);
    if(boardItemId){
        currentBoardItem = items.find(item => item.id == boardItemId);
    }else{
        currentBoardItem = null;
    }
    console.log("try get boardItem.",boardItemId,currentBoardItem);
}

//load person
function loadPerson(personId) {
    console.log("try to load person info.",personId);
    util.AJAX(app.config.data_api+"/user/users/"+personId, function (res) {
        console.log("load person info.",personId,res);
        userInfo = res;
        currentPerson = res._key;
        insertPerson(userInfo);//TODO:当前直接显示默认信息，需要改进为显示broker信息，包括等级、个性化logo等
        //loadData();
        loadBrokerByOpenid(res._key);//根据openid加载broker信息
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
            currentBrokerId = res.data.id;
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

