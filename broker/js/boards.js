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

    //计算图片流宽度：根据屏幕宽度计算，最小显示2列
    if(width < 2*columnWidth){//如果屏幕不能并排2列，则调整图片宽度
        //columnWidth = (width-columnMargin*4)/2;//由于每一个图片左右均留白，故2列有4个留白
    }
    var args = getQuery();//获取参数
    $('#waterfall').NewWaterfall({
        width: columnWidth,
        delay: 100,
    });

    //显示加载状态
    showloading(true);
    //处理参数
    var args = getQuery();//获取参数
    if(args["id"]){
        currentPerson = args["id"]; //如果传入参数则使用传入值
    }
    if(args["filter"]){
        filter = args["filter"]; //如果传入参数则使用传入值：all、byBroker
    }

    $("body").css("background-color","#fff");//更改body背景为白色

    loadPerson(currentPerson);//加载用户

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });

});

util.getUserInfo();//从本地加载cookie

var columnWidth = 800;//默认宽度600px
var columnMargin = 5;//默认留白5px
var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var filter = "byBroker";//byBroker、all。数据查询规则：默认为根据BrokerId查询，可以为查询全部

var items = [];//所有画像列表
var page = {
    size:10,//每页条数
    total:1,//总页数
    current:-1//当前翻页
};

var currentActionType = '';//当前操作类型
var tagging = '';//操作对应的action 如buy view like 等

var currentPerson = app.globalData.userInfo?app.globalData.userInfo._key:null;
var userInfo=app.globalData.userInfo;//默认为当前用户

var currentBroker = null;

function registerTimer(brokerId){
    currentBroker = brokerId;
    setInterval(function ()
    {
        console.log("Timer Boards::registerTimer start load boards Timer.");
        if ($(window).scrollTop() >= $(document).height() - $(window).height() - dist && !loading)
        {
            console.log("Boards::registerTimer start load boards.");
            // 表示开始加载
            loading = true;
            showloading(true);

            // 加载内容
            if(items.length < num){//如果内容未获取到本地则继续获取
                //loadItems();
                if(filter=="all"){
                    loadAllItems();
                }else{
                    loadItemsByBroker();
                }
            }else{//否则使用本地内容填充
                insertItem();
            }
        }
    }, 300);
}

//加载特定于达人的任务列表
function loadItemsByBroker(){
    util.AJAX(app.config.sx_api+"/mod/board/rest/boards/"+currentBroker, function (res) {
        showloading(false);
        console.log("Broker::Boards::loadItems try to retrive boards by broker id.", res)
        if(res && res.count==0){//如果没有画像则提示，
            shownomore();
        }else{//否则显示到页面
            //更新当前翻页
            page.current = page.current + 1;
            //装载具体条目
            var hits = res;
            for(var i = 0 ; i < hits.length ; i++){
                items.push(hits[i]);
            }
            insertItem();
        }
    }, "GET",{offset:(page.current+1)*page.size,size:page.size},{});
}

//加载所有清单：用于推荐时使用
function loadAllItems(){
    util.AJAX(app.config.sx_api+"/mod/board/rest/all-boards", function (res) {
        showloading(false);
        console.log("Broker::Boards::loadItems try to retrive all boards.", res)
        if(res && res.count==0){//如果没有画像则提示，
            shownomore();
        }else{//否则显示到页面
            //更新当前翻页
            page.current = page.current + 1;
            //装载具体条目
            var hits = res;
            for(var i = 0 ; i < hits.length ; i++){
                items.push(hits[i]);
            }
            insertItem();
        }
    }, "GET",{offset:(page.current+1)*page.size,size:page.size},{});
}

//将item显示到页面
function insertItem(){
    // 加载内容
    var item = items[num-1];
    if(!item)return;

    var image = "<img src='http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg' width='60' height='60'/>";
    var title = "<div class='title'>"+item.title+"</div>";
    var description = "<div class='description'>"+item.description+"</div>";
    var tags = "<div class='tags'>"+item.tags+"</div>";
    var btns = "<div class='btns'><a href='../index.html?keyword="+item.keywords+"&boardId="+item.id+"'>添加商品</a>&nbsp;<a href='boards-modify.html?id="+item.id+"'>编辑</a>&nbsp;<a href='../board2.html?id="+item.id+"'>分享文字列表</a>&nbsp;<a href='../board2-waterfall.html?id="+item.id+"'>分享图片列表</a></div>";
    $("#waterfall").append("<li><div class='task' data='"+item.id+"'><div class='task-logo'>" + image +"</div><div class='task-tags'>" +title+ tags +description+btns+"</div></li>");
    num++;

    //注册事件
    $("div[data='"+item.id+"']").click(function(){
        //跳转到编辑界面
        window.location.href = "boards-modify.html?id="+item.id;
    });

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
            registerTimer(res.data.id);//加载该达人的board列表
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

