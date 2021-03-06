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

var currentPerson = app.globalData.userInfo?app.globalData.userInfo._key:null;
var userInfo=app.globalData.userInfo;//默认为当前用户

var currentPersonaId = "none";
var currentPersona = {};

var currentBrokerId = null;
var boardId = null;

var boardItemFormTemplate = '<div class="board-item-form">'+
            //*
            '<div class="form-group">'+
              '<label for="boardItemTitle">推荐标题:</label>'+
              '<input type="text" class="form-control" id="boardItemTitle" placeholder="一句话推荐这个商品"/>'+
            '</div>'+
            //**/
            '<div class="form-group board-item-form-group">'+
              '<label for="boardItemDescription">推荐语:</label>'+
              '<textarea class="form-control" rows="3" id="boardItemDescription" placeholder="描述一下为何值得推荐"></textarea>'+
            '</div>'+    
            '<button type="submit" class="btn btn-default board-item-btn-delete" id="boardItemDeleteBtn">删除</button>'+                          
            '<button type="submit" class="btn btn-default board-item-btn-submit" id="boardItemSubmitBtn">保存</button>'+
        '</div>';

//修改board：注意同时修改board信息以及board列表描述内容
function updateBoard(personaId){
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };     
    var data = {
        title:$("#boardTitle").val(),
        description:$("#boardDescription").val(),
        tags:$("#boardTags").val(),
        keywords:$("#boardKeywords").val()
    };
    util.AJAX(app.config.sx_api+"/mod/board/rest/board/"+boardId, function (res) {
        console.log("Broker::Board::UpdateBoard modify board successfully.", res)
        if(res.status){
            console.log("Broker::Board::UpdateBoard now jump to home page for item adding.", res)
            $.cookie('board', null);  //保存后从cookie里删除修改状态的board
            window.location.href = "boards.html";//跳转到boards列表
            //window.location.href = "../board2.html?id="+boardId;//跳转到board查看界面
        }
    }, "PUT",data,header);
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
            window.location.href = "boards-modify.html?id="+res.data.board.id;//跳转到board查看界面
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
            window.location.href = "boards-modify.html?id="+item.board.id;//跳转到board查看界面
        }
    }, "PUT",{},{});
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
            console.log("Broker::Board::loadBoard now insert board info.", res)
            $.cookie('board', JSON.stringify(res.data), { expires: 3650, path: '/' });  //把编辑中的board写入cookie便于添加item
            displayBoard(res.data);
        }
    }, "GET",{},header);
}

//显示board设置。使用board内容填写
function displayBoard(board){
    $("#boardTitle").val(board.title?board.title:"");
    $("#boardDescription").val(board.description?board.description:"");
    $("#boardTags").val(board.tags?board.tags:"");
    $("#boardKeywords").val(board.keywords?board.keywords:"");
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
    }, "GET",{},header);
}


function loadItem(item){//获取内容列表
    $.ajax({
        url:"https://data.shouxinjk.net/_db/sea/my/stuff/"+item.item,
        type:"get",
        data:{},
        success:function(data){
            item.stuff = data;//装载stuff到boarditem   
            items.push(item); //装载到列表 
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
        logoImg = item.stuff.images[0];//默认用第一张图片做logo
    }

    //显示所关联stuff内容
    var image = "<img src='"+logoImg+"' width='60' height='60'/>";
    var title = "<div class='board-item-title'>"+item.stuff.distributor.name+" "+item.stuff.title+"</div>";
    var tags = "";//"<div class='tags'>"+item.stuff.tags+"</div>";

    //显示boarditem推荐标题及推荐描述
    var itemForm =  boardItemFormTemplate
        .replace(/boardItemTitle/g,'boardItemTitle'+num)
        .replace(/boardItemDescription/g,'boardItemDescription'+num)
        .replace(/boardItemSubmitBtn/g,'boardItemSubmitBtn'+num)
        .replace(/boardItemDeleteBtn/g,'boardItemDeleteBtn'+num);

    $("#waterfall").append("<li><div class='board-item' data='"+item.id+"'><div class='board-item-logo'>" + image +"</div><div class='board-item-tags'>" +title+ tags +itemForm+"</div></li>");

    //使用已经有的数值填写表单
    $('#boardItemTitle'+num).val(item.title?item.title:item.stuff.title);
    $('#boardItemDescription'+num).val(item.description?item.description:item.stuff.tags);
    //注册事件：能够单独修改
    $('#boardItemSubmitBtn'+num).click(function(){
        var eleId=$(this).attr("id");//必须通过源id获取指定下标
        var itemNumber = eleId.match(/\d+/g)[0];
        item.title = $('#boardItemTitle'+itemNumber).val();
        item.description = $('#boardItemDescription'+itemNumber).val();
        updateBoardItem(item);
    });
    //注册事件：能够单独删除
    $('#boardItemDeleteBtn'+num).click(function(){
        deleteBoardItem(item);
    });

    num++;
    // 表示加载结束
    loading = false;
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

function insertPerson(person){
    // 显示HTML
    var html = '';
    html += '<div class="info-general">';
    html += '<img class="general-icon" src="'+person.avatarUrl+'" height="60px"/>';
    html += '</div>';
    html += '<div class="info-detail">';
    html += '<div class="info-text info-blank">'+person.nickName+'</div>';
    html += '<div class="info-text info-blank" id="brokerHint">'+(person.province?person.province:"")+(person.city?(" "+person.city):"")+'</div>';
    html += '<div class="info-text info-blank" id="brokerLink"><a href="../user.html">返回用户后台</a></div>';
    html += '</div>';
    $("#user").append(html);
}

function insertBroker(broker){
    $("#brokerHint").html("达人级别："+broker.level);
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

