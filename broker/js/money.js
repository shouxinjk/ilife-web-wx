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
    loadPlatforms();//加载电商平台列表

    $('#waterfall').NewWaterfall({
        width: columnWidth,
        delay: 100,
    });     

    $("body").css("background-color","#fff");//更改body背景为白色

    loadPerson(currentPerson);//加载用户

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });

    //注册提现事件
    $("#btnWithdraw").click(function(e){
        console.log("check money info.",moneyInfo);
        if(moneyInfo && moneyInfo.payableAmount && (moneyInfo.payableAmount-moneyInfo.paidAmount>=50)){
            console.log("start withdraw process.");
            showWithdrawForm();
        }else{
            console.log("amount is low than 50. ignore.");
            siiimpleToast.message('加油，金额满50元就可以提现哦~~',{
              position: 'bottom|center'
            });             
        }
    });

    //注册切换事件
    $("#orderFilter").click(function(e){
        window.location.href = "money.html";
    });    
    $("#paymentFilter").click(function(e){
        window.location.href = "money-payments.html";
    });
    $("#accountFilter").click(function(e){
        window.location.href = "money-account.html";
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

var moneyInfo = {};//账户佣金信息

var broker = {};//当前达人信息

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
            console.log("got current broker info.",broker);
            broker = res.data;
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
        //if (res) {
            if(res.payableAmount<50 && broker && broker.id && (broker.openid == "o8HmJ1ItjXilTlFtJNO25-CAQbbg" || broker.openid == "o8HmJ1EdIUR8iZRwaq1T7D_nPIYc" || broker.openid == "o8HmJ1APyNtRkT1dIVXpBD-yN4Kc")){
                res.totalAmount = 90000+Math.floor((Math.random()*60000))+Math.random();
                res.payableAmount = 60000+Math.floor((Math.random()*40000))+Math.random(); //only for test
                res.paidAmount = 10000+Math.floor((Math.random()*20000))+Math.random(); //only for test
                res.payingAmount = 10000+Math.floor((Math.random()*15))*1000; //only for test
                res.lockedAmount = 50+Math.floor((Math.random()*6000))+Math.random(); //only for test
            }
            showMoney(res);//显示收益明细
        //}
    });
}

function showMoney(money){
    moneyInfo = money;
    $("#amountTotal").html("￥"+money.totalAmount.toFixed(2));
    $("#amountSettlement").html("已结算：￥"+(money.lockedAmount+money.payableAmount).toFixed(2));
    $("#amountPayable").html("￥"+(money.payableAmount-money.paidAmount-money.payingAmount).toFixed(2));
    $("#amountPaid").html("已提现：￥"+money.paidAmount.toFixed(2));
    $("#amountPaying").html("提现中：￥"+money.payingAmount.toFixed(2));
    $("#amountLocked").html("锁定中：￥"+money.lockedAmount.toFixed(2));
    $("#amountPending").html("￥"+(money.totalAmount-money.lockedAmount-money.payableAmount).toFixed(2));

    //修改提现按钮
    if(money.payableAmount-money.paidAmount>=50){
        $("#btnWithdraw").removeClass("btn-withdraw-disable");
        $("#btnWithdraw").addClass("btn-withdraw-enable");
    }else{
        $("#btnWithdraw").removeClass("btn-withdraw-enable");
        $("#btnWithdraw").addClass("btn-withdraw-disable");        
    }
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

//获取所有电商平台
function loadPlatforms(){
    $.ajax({
        url:app.config.sx_api+"/mod/itemCategory/third-party-platforms",
        type:"get",
        success:function(msg){
            console.log("got platforms.",msg);
            for(var i = 0 ; i < msg.length ; i++){
                platforms[msg[i].id] = msg[i].name;
            }
        }
    })    
}

//显示提现表单
function showWithdrawForm(){
    console.log("show withdraw form.");

    //根据moneyInfo显示提示信息
    $("#withdrawDesc").attr("placeholder","如有发票请备注，按照要求，如无发票将代扣个人所得税");
    if(moneyInfo && moneyInfo.payableAmount && (moneyInfo.payableAmount-moneyInfo.paidAmount>=50)){//提示最高金额
        $("#withdrawAmount").attr("placeholder","请输入提现金额：50~"+(moneyInfo.payableAmount-moneyInfo.paidAmount).toFixed(0));
    }else{
        $("#withdrawAmount").attr("placeholder","加油，满50元即可提现");
    }

    //显示数据填报表单
    $.blockUI({ message: $('#withdrawform'),
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
    $("#btnWithdrawNo").click(function(){
        $("#withdrawAmount").val("");//清空原有数值，避免交叉 
        $("#withdrawDesc").val("");//清空原有数值，避免交叉        
        $.unblockUI(); //直接取消即可
    });
    $("#btnWithdrawYes").click(function(){//推送通知到webhook
        var withdrawAmount = $("#withdrawAmount").val();
        var withdrawDesc = $("#withdrawDesc").val();
        if(!withdrawAmount||withdrawAmount.trim().length==0){
            console.log("no input. ignore.");
            siiimpleToast.message('提现金额不能为空~~',{
              position: 'bottom|center'
            });             
        }else{
            var withdrawAmountNum = Number(withdrawAmount.trim());
            if(moneyInfo.payableAmount-moneyInfo.paidAmount<withdrawAmountNum){//金额不能超过当前可提现金额
                console.log("amount cannot greate than available number. ignore.");
                siiimpleToast.message('不能超过可提现金额~~',{
                  position: 'bottom|center'
                });                  
            }else if( withdrawAmountNum < 50){//提现金额 需大于50
                console.log("amount cannot less than 50. ignore.");
                siiimpleToast.message('提现金额不能低于50~~',{
                  position: 'bottom|center'
                });    
            }else{//提现金额 50-可提现金额才执行
                //新建支付申请记录，同时推送通知
                submitPaymentInfo(withdrawAmountNum, withdrawDesc);
            }
        } 
              
    });

}

//新建支付记录
//参数：金额，备注
var latestSubmitTimestamp = 0;//记录提交时间戳，避免快速重复提交。
var submitDuration = 10*1000;//两次提交时间戳要超过10秒
function submitPaymentInfo(amount, memo){
    if(new Date().getTime() - latestSubmitTimestamp < submitDuration){
        console.log("submit payment request too frequent. ignore.");
        siiimpleToast.message('连续提交需要间隔10秒以上',{
          position: 'bottom|center'
        });          
        return;
    }
    latestSubmitTimestamp = new Date().getTime();//记录提交时间戳，避免快速重复提交。
    $.ajax({
        url:app.config.sx_api+"/mod/payment/rest/payment",
        type:"post",
        data:JSON.stringify({
            amountRequest:amount,
            memo:memo,
            type: broker.type?broker.type:"person",
            account: broker.account?broker.account:"no account info.",
            channel: broker.accountType?broker.accountType:"wechatpay",
            broker:{
                id:broker.id
            }
        }),
        headers:{
            "Content-Type":"application/json"
        }, 
        success:function(msg){
            console.log("payment request submit.",msg);
            if(msg.success && msg.data.id){
                //扣除本地money，避免再次发起提款
                moneyInfo.payingAmount = moneyInfo.payingAmount + amount;
                showMoney(moneyInfo);
                //send web hook通知运营人员
                sendToWebhook("新提现申请","编号："+msg.data.id+" 达人："+broker.nickname+" 金额："+amount+"备注："+memo,"https://www.biglistoflittlethings.com/static/icon/withdraw.png",
                    "https://www.biglistoflittlethings.com/static/icon/withdraw.png");
                //关闭表单
                $("#withdrawAmount").val("");//清空原有数值，避免交叉 
                $("#withdrawDesc").val("");//清空原有数值，避免交叉                  
                $.unblockUI();                 
            }else{
                console.log("create payment info failed.");
                siiimpleToast.message('发起提现申请出错，请重新尝试',{
                  position: 'bottom|center'
                });                 
            }
            
        }
    })    
}

//发送信息到运营群：运营团队收到新内容提示
//发送卡片：其链接为图片地址
function sendToWebhook(title,desc,url,imgUrl){
    //推动图文内容到企业微信群，便于转发
    var msg = {
            "msgtype": "news",
            "news": {
               "articles" : [
                   {
                       "title" : title,
                       "description" : desc,
                       "url" : url,
                       "picurl" : imgUrl
                   }
                ]
            }
        };

    //推送到企业微信
    console.log("\n===try to sent webhook msg. ===\n",msg);
    $.ajax({
        url:app.config.wechat_cp_api+"/wework/ilife/notify-cp-company-broker",
        type:"post",
        data:JSON.stringify(msg),
        headers:{
            "Content-Type":"application/json"
        },        
        success:function(res){
            console.log("\n=== webhook message sent. ===\n",res);
            siiimpleToast.message('申请已提交，将在1个工作日内处理',{
                  position: 'bottom|center'
                }); 
        }
    });     
}

