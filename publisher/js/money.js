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
        currentPerson = args["id"]; //如果传入参数则使用传入值
    }

    $('#waterfall').NewWaterfall({
        width: columnWidth,
        delay: 100,
    });     

    $("body").css("background-color","#fff");//更改body背景为白色
    loadPlatforms();//加载电商平台列表
    loadPerson(currentPerson);//加载用户


    //注册切换：文章/公众号
    $("#myArticleFilter").click(function(e){
        window.location.href = "my.html";
    });
    $("#myAccountFilter").click(function(e){
        window.location.href = "my-accounts.html";
    });
    $("#myTeamFilter").click(function(e){
        window.location.href = "team.html";
    }); 
    $("#myMoneyFilter").click(function(e){
        window.location.href = "money.html";
    });  

    //取消充值
    $("#btnCancelCharge").click(function(e){
        $.unblockUI(); 
    });      

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

var platforms = {
    taobao:"淘宝",
    ctrip:"携程",
    tmall:"天猫",
    jd:"京东",
    lvmama:"驴妈妈",
    tongcheng:"同程",
    dangdang:"当当"
};

var statusArr= {
    cleared:"已结算",
    pending:"结算中",
    locked:"当前锁定。待团队指标达成后解锁"
};

var currentBroker = null;

function startLoadOrders(brokerId){
    currentBroker = brokerId;
    setInterval(function ()
    {
        if ($(window).scrollTop() >= $(document).height() - $(window).height() - dist && !loading)
        {
            // 表示开始加载
            loading = true;
            showloading(true);

            // 加载内容
            if(items.length < num){//如果内容未获取到本地则继续获取
                loadItems();
            }else{//否则使用本地内容填充
                insertItem();
            }
        }
    }, 500);
}

//加载订单列表
function loadItems(){
    util.AJAX(app.config.sx_api+"/mod/clearing/rest/money/byOrder/"+currentBroker, function (res) {
        showloading(false);
        console.log("money::loadItems try to retrive orders by brokerId.", res)
        if(res && res.length==0){//如果没有订单则提示，
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
    var placeHolder = "<div class='placeholder'></div>";
    var orderTime = "<div class='order-item'>时间："+item.orderTime.split(" ")[0]+"</div>";
    var itemTitle = "<div class='order-item'>"+"商品："+(platforms[item.platform]?platforms[item.platform]:item.platform)+" "+item.item+"</div>";
    var profitAmount = "<div class='order-item'>佣金："+item.amountProfit+"</div>";
    var profitStatus = "<div class='order-item'>状态："+statusArr[item.statusClear]+"</div>";
    $("#waterfall").append("<li><div class='order-separator' style='border-radius:0'></div><div class='order-entry' data='"+item.id+"'>"+placeHolder+"<div class='order-box'>"+itemTitle +orderTime +profitAmount+profitStatus+"</div>"+placeHolder+ "</div></li>");

    //注册事件
    $("div[data='"+item.id+"']").click(function(){
        //点击后跳转到对应的商品？当前存在跳转障碍
    });

    num++;//下标加一
    loading = false;// 表示加载结束
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
            getMoney(res.data.id);//查询达人收益信息
            startLoadOrders(res.data.id);//加载订单信息
        }
    });
}

//查询达人收益
function getMoney(brokerId) {
    console.log("try to load broker money info by brokerId.",brokerId);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/money/"+brokerId, function (res) {
        console.log("load broker money info.",brokerId,res);
        if (res) {
            showMoney(res);//显示收益明细
        }
    });
}

function showMoney(money){
    $("#amountTotal").html("￥"+money.totalAmount.toFixed(2));
    $("#amountSettlement").html("￥"+(money.lockedAmount+money.payableAmount).toFixed(2));
    $("#amountPayable").html("可提现：￥"+(money.payableAmount-money.paidAmount).toFixed(2));
    $("#amountPayment").html("已提现：￥"+money.paidAmount.toFixed(2));
    $("#amountLocked").html("已锁定：￥"+money.lockedAmount.toFixed(2));
    $("#amountPending").html("￥"+(money.totalAmount-money.lockedAmount-money.payableAmount).toFixed(2));
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

//加载所有支持的电商平台
function loadPlatforms(){
    $.ajax({
        url:"http://www.shouxinjk.net/ilife/a/mod/itemCategory/third-party-platforms",
        type:"get",
        success:function(msg){
            console.log("got platforms.",msg);
            for(var i = 0 ; i < msg.length ; i++){
                platforms[msg[i].id]=msg[i].name;
                $("#platformDiv").append("<div class='checkbox'><input type='checkbox' name='platform' id='platform-"+msg[i].id+"' value='"+msg[i].id+"'/><label for='platform-"+msg[i].id+"'>"+msg[i].name+"</label></div>");
            }
        }
    })    
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

