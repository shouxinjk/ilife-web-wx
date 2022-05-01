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
    if(args["byOpenid"]){
        byOpenid = args["byOpenid"]; //预留。能够指定当前用户openid
    }  
    if(args["byPublisherOpenid"]){
        byPublisherOpenid = args["byPublisherOpenid"]; //支持传入publisherOpenid
    }        

    if(args["code"]){
        groupingCode = args["code"]; //支持传入班车code
    }else{
        groupingCode = generateShortCode(getUUID());//否则随机生成一个
    }   
    if(args["groupingName"]){
        groupingName = args["groupingName"]; //支持传入班车code
    }else{
        groupingName = new Date().getFullYear()+"-"+(new Date().getMonth()+1)+"-"+new Date().getDate()+" 互关班车";//班车名称
    }  
    $("#groupingName").text(groupingName);
    if(args["groupingDesc"]){
        groupingDesc = args["groupingDesc"]; //支持传入班车code
    }else{
        groupingDesc = "发公众号上车，关注确认，结果自动统计";//班车描述
    }            
    if(args["timeFrom"]){
        timeFrom = args["timeFrom"]; //班车开始时间
    }else{
        timeFrom = new Date().getTime();//否则为当前时间
    }
    if(args["timeTo"]){
        timeTo = args["timeTo"]; //班车结束时间
    }else{
        timeTo = timeFrom + 60*60*1000;//否则为当前时间持续1小时
    }

    $("body").css("background-color","#fff");//更改body背景为白色

    //加载达人信息
    loadBrokerInfo();

    //loadPerson(currentPerson);//加载用户
    if(app.globalData.userInfo&&app.globalData.userInfo._key){//如果本地已有用户则直接加载
        loadPerson(currentPerson);//加载用户
    }else{//否则显示二维码
        showWxQrcode();
        //显示数据填报表单
        $.blockUI({ message: $('#bindQrcodeform'),
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
    }


    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });

    //注册点击创建按钮事件 ：显示表单
    $("#createAccountBtn").click(function(e){
        showAccountForm();
    });

    //取消关注
    $("#btnQuitQrcode").click(function(){
    	$("#pendingAccountQrcode").empty();
		$.unblockUI(); 
    });
    $("#btnYesSubscribe").click(function(){//完成关注确认
        submitResult();       	
    });    
    

    //取消充值
    $("#btnCancelCharge").click(function(e){
        $.unblockUI(); 
    });  

    //检查是否有缓存事件
    //resultCheck();

    //注册事件：刷新合集
    $("#reloadGrouping").click(function(){
        window.location.href = "accounts-grouping.html?code="+groupingCode+"&groupingName="+groupingName+"&timeFrom="+timeFrom+"&timeTo="+timeTo;
    });
    //注册事件：跳转到报告查看页面
    $("#checkReport").click(function(){
        window.location.href = "report-grouping2.html?code="+groupingCode+"&groupingName="+groupingName;
    });   

    //注册分享事件
    registerShareHandler();
});

//解决返回时不重新加载问题
window.onpageshow = function (event) {     
    if (event.persisted) {
        window.location.reload()
    }
} 

util.getUserInfo();//从本地加载cookie

var byOpenid = null;
var byPublisherOpenid = null;

var instSubscribeTicket = null;//对于即时关注，需要缓存ticket
var groupingCode = null;//班车code：默认自动生成
var timeFrom = new Date().getTime();//班车开始时间:long，默认为当前时间
var timeTo = timeFrom+60*60*1000;//班车结束时间:long，默认持续一个小时


//设置默认logo
var logo = "https://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg";

var columnWidth = 800;//默认宽度600px
var columnMargin = 5;//默认留白5px
var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var filter = "all";//my、all。数据查询规则：默认为查询全部

var items = [];//所有画像列表
var page = {
    size:10,//每页条数
    total:1,//总页数
    current:-1//当前翻页
};

var publiserIds = [];//记录已加载文章的发布者ID

var currentActionType = '';//当前操作类型
var tagging = '';//操作对应的action 如buy view like 等

var currentPerson = app.globalData.userInfo?app.globalData.userInfo._key:null;
var userInfo=app.globalData.userInfo;//默认为当前用户

var currentBroker = null;
var broker = {};//当前达人

var sxTimer = null;
var sxStartTimestamp=new Date().getTime();//定时器如果超过2分
var sxLoopCount = 1000;//定时器运行100次即停止，即30秒


//请求qrcode并显示二维码，供达人扫码绑定
function showWxQrcode(){
    //检查缓存是否有ticket
    var instTicketInfo = $.cookie('sxInstTicket');
    console.log("load instTicketInfo from cookie.",instTicketInfo);
    if(instTicketInfo && instTicketInfo.trim().length>0){//有缓存，表示是已经扫码后返回，直接显示二维码并查询即可
        var instTicket = JSON.parse(instTicketInfo.trim());
        //显示二维码
        $("#wxQrcodeDiv").html("<img width='240' src='"+instTicket.url+"' style='display:block;margin:0 auto;'/>");
        //开始轮询扫码结果
        setInterval(function ()
        {
          getQrcodeScanResult(instTicket.ticket);//实际是6位短码               
        }, 500);            
    }else{//否则表示初次进入，直接请求新的二维码
        $.ajax({
            url:app.config.auth_api+"/wechat/ilife/inst-qrcode",
            type:"get",
            data:{
                code:groupingCode  //默认传递班车编码
            },
            success:function(res){
                console.log("got qrcode and redirect.",res);
                //显示二维码
                $("#wxQrcodeDiv").html("<img width='240' src='"+res.url+"' style='display:block;margin:0 auto;'/>");
                //将ticket缓存，在完成关注后返回还能继续查询
                var expDate = new Date();
                expDate.setTime(expDate.getTime() + (5 * 60 * 1000)); // 5分钟后自动失效：避免用户进入关注界面超时不回来    
                console.log("Publisher::Articles-grouping save inst ticket to cookie.",res);
                $.cookie('sxInstTicket', JSON.stringify(res), { expires: expDate, path: '/' });  //再返回时便于检查  
                //根据返回的短码，生成链接，便于从公众号关注后的模板消息进入
                var state = "publisher__accounts-grouping___code="+groupingCode+"__timeFrom="+timeFrom+"__timeTo="+timeTo;
                var longUrl = "https://open.weixin.qq.com/connect/oauth2/authorize?appid=wxe12f24bb8146b774&redirect_uri=https://www.biglistoflittlethings.com/ilife-web-wx/dispatch.html&response_type=code&scope=snsapi_userinfo&state=";
                longUrl += state;
                longUrl += "#wechat_redirect";
                saveShortCode(hex_md5(longUrl),"page_"+res.ticket,"","","mp",encodeURIComponent(longUrl),res.ticket);             
                //开始轮询扫码结果
                setInterval(function ()
                {
                  getQrcodeScanResult(res.ticket);//实际是6位短码               
                }, 500);
                //**/
            }
        });
    }
}

//查询扫码结果，将返回openid
function getQrcodeScanResult(ticket){
    console.log("try to query scan result by uuid.",ticket);
    $.ajax({
        url:app.config.auth_api+"/wechat/ilife/bind-openid?uuid="+ticket,//根据短码查询关注结果
        type:"get",
        data:{},
        success:function(res){
            console.log("got qrcode scan result.",res);
            if(res.status && res.openid){//成功扫码，刷新页面：需要通过微信授权页面做一次跳转，要不然无法获取用户信息
                var state = "publisher__accounts-grouping___code="+groupingCode+"__timeFrom="+timeFrom+"__timeTo="+timeTo;
                //https://open.weixin.qq.com/connect/oauth2/authorize?appid=wxe12f24bb8146b774&redirect_uri=https://www.biglistoflittlethings.com/ilife-web-wx/dispatch.html&response_type=code&scope=snsapi_userinfo&state=index#wechat_redirect
                var targetUrl = "https://open.weixin.qq.com/connect/oauth2/authorize?appid=wxe12f24bb8146b774&redirect_uri=https://www.biglistoflittlethings.com/ilife-web-wx/dispatch.html&response_type=code&scope=snsapi_userinfo&state=";
                targetUrl += state;
                targetUrl += "#wechat_redirect";
                window.location.href = targetUrl;          
            }
        }
    });
}


//优先从cookie加载达人信息
function loadBrokerInfo(){
  broker = util.getBrokerInfo();
  currentBroker = broker.id;
}

function registerTimer(brokerId){
    currentBroker = brokerId;
    sxTimer = setInterval(function ()
    {
        //console.log("Articles::registerTimer.");
        if ($(window).scrollTop() >= $(document).height() - $(window).height() - dist && !loading)
        {
            console.log("Articles::registerTimer start load article.");
            // 表示开始加载
            loading = true;
            showloading(true);

            // 加载内容
            if(items.length < num){//如果内容未获取到本地则继续获取
                console.log("request articles from server side.");
                //读取待阅读列表
                loadItems();
                //有用户操作则恢复计数器
                console.log("reset loop count.");
                sxLoopCount = 100;                
            }else{//否则使用本地内容填充
                console.log("insert article item from locale.");
                insertItem();
            }
        }

        //计数器自减，到时即停止
        /**
        if(--sxLoopCount<0){
            unregisterTimer();
        }
        //**/
    }, 100);
}

function unregisterTimer(){
    console.log("clear timer.");
    clearInterval(sxTimer);
}


/*
加载待阅读文章列表：
按照阅豆高低倒序排列得到最新文章列表
*/
var tmpAccountIds = [];//缓存已加载的公众号ID，避免置顶公众号与普通公众号重复显示
function loadItems(){
    util.AJAX(app.config.sx_api+"/wx/wxAccount/rest/grouping-accounts", function (res) {
        showloading(false);
        console.log("Publisher::Accounts::loadItems try to retrive pending accounts.", res)
        if(res && res.length==0){//如果没有画像则提示，
            shownomore(true); 
            /**
            if(!items || items.length==0){
                $("#Center").append("<div style='font-size:12px;line-height:24px;width:100%;text-align:center;'>没有待粉公众号哦~~</div>");
            }     
            //**/    
        }else{//否则显示到页面
            //更新当前翻页
            page.current = page.current + 1;
            //装载具体条目
            var hits = res;
            for(var i = 0 ; i < hits.length ; i++){
                //items.push(hits[i]);
                if(tmpAccountIds.indexOf(hits[i].id)<0){
                    items.push(hits[i]);
                    tmpAccountIds.push(hits[i].id);
                }else{
                    //ignore
                }
                //将文章发布者ID缓存，便于检查是否需要提示发布文章
                if(publiserIds.indexOf(hits[i].broker.id)<0){
                    publiserIds.push(hits[i].broker.id);
                }                 
            }
            //检查用户是否已发布公众号
            checkAccountGrouping();
            //开始显示到界面             
            insertItem();
        }
    }, 
    "GET",
    {
        from:(page.current+1)*page.size,
        to:(page.current+1)*page.size+page.size,
        openid:byOpenid?byOpenid:userInfo._key,//当前订阅者的openid：用于排除已经关注的内容
        code:groupingCode,//微信开车群编号
        publisherOpenid:byPublisherOpenid?byPublisherOpenid:""//发布者 openid：只显示指定发布者的内容
    },
    {});
}


//检查当前文章列表中是否已经有当前用户的文章，如果没有则显示添加文章表单
var accountsLoaded = false;//文章是否已加载标志，便于多个源头触发
function checkAccountGrouping(){
    console.log("check article grouping. publiserIds",publiserIds, broker.id);

    //检查当前达人是否有文章加入开车，以判断是否显示添加文章按钮
    $.ajax({
        url:app.config.sx_api+"/wx/wxAccount/rest/grouping-accounts",
        type:"get",
        data:{
            from:0,
            to:1,//仅用于判断，1条即可
            openid:"",//忽略是否已经阅读
            code:groupingCode,//微信群编号
            publisherOpenid:userInfo._key//发布者 openid：只显示指定发布者的内容
        },
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },        
        success:function(myAccounts){
            if(myAccounts && myAccounts.length==0){//如果当前列表中没有当前达人的文章，则显示添加按钮
                $("#createAccountEntry").css("display","block");
                $("#createAccountBtn").css("display","flex");
                if($("#Center").length<=0)
                    $("#Center").append("<div id='blankGroupingTips' style='font-size:12px;line-height:24px;width:100%;text-align:center;'>请发布公众号加入~~</div>");
            }else{//否则隐藏添加按钮
                $("#createAccountEntry").css("display","none");
                $("#createAccountBtn").css("display","none");
                if($("#Center").length<=0)
                    $("#Center").append("<div id='blankGroupingTips' style='font-size:12px;line-height:24px;width:100%;text-align:center;'>已发布公众号，请完成关注~~</div>");
            }
        }
    });

    //加载当前达人已发布的公众号，便于选择
    console.log("try to load accounts.",!accountsLoaded&&broker&&broker.id&&publiserIds.indexOf(broker.id)<0);
    if(!accountsLoaded&&broker&&broker.id&&publiserIds.indexOf(broker.id)<0){
        accountsLoaded = true;
        //加载当前达人发布的文章列表，仅显示最近发布的10篇文章
        $.ajax({
            url:app.config.sx_api+"/wx/wxAccount/rest/my-accounts/"+userInfo._key,
            type:"get",
            data:{
                from:0,
                to: 10 //仅显示最近10条
            },
            headers:{
                "Content-Type":"application/json",
                "Accept": "application/json"
            },        
            success:function(myAccounts){
                //根据结果处理：如果没有则显示新增表单；如果仅有1条则直接加入；如果有多条则提示选择框
                console.log("got my accounts.",myAccounts);

                myAccounts.forEach(function(myAccount){
                    //显示到界面
                    var html = '<div style="display:flex;flex-direction: row"><div style="width:80%;line-height:30px;font-size:12px;">';
                    html+= myAccount.name;
                    html+='</div><div style="width:20%">';
                    html+='<button type="submit" class="btnYes" id="btnPublish_'+myAccount.id+'" data-originid="'+myAccount.originalId+'"  data-name="'+myAccount.name+'" data-updateDate="'+myAccount.updateDate+'">加入</button>';
                    html+='</div></div>';
                    $("#accountform").append(html);
                    //注册事件：选择后加入grouping，并显示到界面，然后隐藏当前表单
                    //需要有id、title、url、updatedate
                    $("#btnPublish_"+myAccount.id).click(function(e){
                        console.log("add exists article to grouping.");
                        var selectedItem = {
                            id:$(this).attr("id").replace(/btnPublish_/g,""),
                            name:$(this).attr("data-name"),
                            originalId:$(this).attr("data-originid"),
                            updateDate:$(this).attr("data-updateDate")
                        }
                        $.unblockUI(); //屏幕解锁
                        //加入grouping
                        groupingItem(selectedItem);
                        //显示到待阅文章列表内
                        toppingItem(selectedItem);
                    });
                });

            }
        });       
    }
}


//将item显示到页面
function insertItem(){
    // 加载内容
    var item = items[num-1];
    if(!item){
        shownomore(true);
        return;
    }

    //文章无logo，随机指定一个。设置为发布者LOGO，或者直接忽略
    logo = "https://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg";
    //直接根据originalId显示缩略图
    if(item.originalId){
        logo = "https://open.weixin.qq.com/qr/code?username="+item.originalId;
    }

    //判断有无置顶广告位
    var tags = "";
    var advertise = "";
    if(item.status&&item.status>1){//如果有广告位则显示置顶
        tags += "<span style='margin-right:5px;padding:0 2px;border:1px solid red;color:red;border-radius:5px;font-size:12px;line-height:16px;'>无敌置顶</span>";
        advertise = "<img src='https://www.biglistoflittlethings.com/ilife-web-wx/images/rocket.png' width='16' height='16'/>&nbsp;";
    }else if(item.status&&item.status>0){//临时置顶
        tags += "<span style='margin-right:5px;padding:0 2px;border:1px solid red;color:red;border-radius:5px;font-size:12px;line-height:16px;'>顶一下</span>";
    }
    
    var title = "<div class='title'>"+tags+item.name/*+(item.counts?"("+item.counts+"粉)":"")*/+advertise+"</div>";
    var imageBg = "<div id='qrcodeimg"+item.id+"' class='qrcodeimg'></div>";
    var description = "<div class='description'>"+item.description+"</div>";
    var pubishDate = "<div class='description'>"+item.updateDate+"</div>";

    var btns = "<div class='btns'><div id='article-"+item.id+"' data-id='"+item.id+"'>前往关注</div></div>";

    //显示logo二维码供扫描关注
    $("#waterfall").append("<li><div class='task' data='"+item.id+"' data-title='"+item.name+"' data-originid='"+item.originalId+"' data-url='"+logo+"'><div class='task-logo'>" + imageBg +"</div><div class='task-tags'>" +title +description+pubishDate+"</div></li>");
    num++;

    //设置背景图片
    $("#qrcodeimg"+item.id).css("background-image","url("+logo+")");

    //注册事件
    $("div[data='"+item.id+"']").click(function(){
        //cookie缓存记录当前浏览文章，返回时检查
        console.log("Publisher::Accounts now jump to account.");
        var expDate = new Date();
        expDate.setTime(expDate.getTime() + (60 * 1000)); // 60秒钟后自动失效：避免用户直接叉掉页面不再回来    
        var pendingAccount = {
            id:$(this).attr("data"),//id
            name:$(this).attr("data-title"),//标题
            originalId:$(this).attr("data-originid"),//公众号ID
            startTime: new Date().getTime()//开始时间戳：需要超过10秒
        };
               
        console.log("Publisher::Accounts save account to cookie.",pendingAccount);
        $.cookie('sxAccount', JSON.stringify(pendingAccount), { expires: expDate, path: '/' });  //把浏览中的id写入cookie便于记录阅读数       

        //显示二维码供扫描关注
        console.log("Publisher::Accounts now show QRcode.");
        $("#pendingAccountQrcode").append("<img src='"+$(this).attr("data-url")+"' width='200' height='200'/>");    
        //二维码长按事件：模拟关注，在等待1.5秒后显示确认按钮
        setTimeout(function(){
            $("#btnYesSubscribe").css("display","block");
        },3200);
        
	    //显示二维码
	    $.blockUI({ message: $('#qrcodeform'),
	        css:{ 
	            padding:        10, 
	            margin:         0, 
	            width:          '80%', 
	            top:            '10%', 
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
            $.cookie('sxBroker', JSON.stringify(res.data), {  path: '/' });     
            broker = res.data; 
            insertBroker(res.data);//显示达人信息
            //仅对于在时间有效期内的才加载数据，否则直接提示已结束
            /**
            if(timeTo && new Date().getTime()>parseFloat(timeTo) ){//如果传递了截止时间，则判断是否超时
                $("#Center").append("<div style='width:100%;text-align:center;font-size:12px;margin:20px;'>哎呀，已经结束了，下次请赶早哦~~~</div>");
                $("#loading").css("display","none");
            }else{
                //**/
                registerTimer(res.data.id);//加载该达人的account列表
                checkAccountGrouping();//检查加载达人的account列表
            //}            
        }
    });
}

/**
function insertBroker(broker){
    $("#brokerHint").html("流量主");
}
//**/

//显示没有更多内容
function shownomore(flag){
  if(flag){
    unregisterTimer();
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

//关注完成后提交并扣除阅豆
function submitResult(){
    var accountInfo = $.cookie('sxAccount');
    console.log("load accountInfo from cookie.",accountInfo);
    if(accountInfo && accountInfo.trim().length>0){
        console.log("get accountInfo info from cookie.",accountInfo);
        var account = JSON.parse(accountInfo);
        console.log("try to submit subscribe event.");
        $.cookie('sxAccount', "", { path: '/' }); //清除cookie重新来过
        $("#btnNoSubscribe").css("display","none");//再次隐藏已关注按钮
        costPoints(account);        	
    }else{
      console.log("no accountInfo from cookie.",accountInfo);
    }
}

//检查关注效果：如果检查到有cookie，则显示已关注按钮
function resultCheck(){
    var accountInfo = $.cookie('sxAccount');
    console.log("load accountInfo from cookie.",accountInfo);
    siiimpleToast.message('检查关注结果：'+accountInfo,{
          position: 'bottom|center'
        });      
    if(accountInfo && accountInfo.trim().length>0){
        console.log("get accountInfo info from cookie.",accountInfo);
        var account = JSON.parse(accountInfo);
        $("#btnYesSubscribe").css("display","block");
        /**
        //显示二维码到界面：如果未关注，再给一次机会
        $("#pendingAccountQrcode").append("<img src='"+$(this).attr("data-url")+"' width='200' height='200'/>"); 
        $("#btnNoSubscribe").click(function(){
            $.cookie('sxAccount', "", { path: '/' }); //清除cookie重新来过
            $.unblockUI(); 
        });
        $("#btnYesSubscribe").click(function(){//完成关注确认
            console.log("try to submit subscribe event.");
            $.cookie('sxAccount', "", { path: '/' }); //清除cookie重新来过
            costPoints(account);        	
        });
        //**/
    }else{
      console.log("no accountInfo from cookie.",accountInfo);
    }
}

//完成订阅扣除及奖励
function costPoints(account){
    //先扣除阅豆
    console.log("try to commit subscribe event.",userInfo._key);
    $.ajax({
        url:app.config.sx_api+"/wx/wxAccount/rest/subscribe/"+account.id+"/"+userInfo._key,
        type:"post",
        success:function(res){
            console.log("cost point succeed.",res);
            logPointCostEvent(account,res);//记录本次关注历史
            //解除屏幕锁屏
            $.unblockUI(); 
            //扣除阅豆，并更新当前阅豆数
            if(broker&&broker.points&&res.points){
                broker.points = broker.points+res.points;
                insertBroker(broker);
            }             
            //提示阅读已完成
            siiimpleToast.message('已奖励'+res.points+'阅豆，关注过的公众号将不再显示哦~~',{
                  position: 'bottom|center'
                });            
        }
    })      
}

//记录关注历史：subscriber内包含有文章发布者信息：openid,brokerId,nickname,avatarUrl 消耗的点数points
//需要补全：关注者openid，nickname，avatarUrl，关注时间，公众号ID
//记录ID为：公众号ID+关注者openid md5
function logPointCostEvent(account,subscriber){
    $.ajax({
        url:app.config.analyze_api+"?query=insert into ilife.subscribes values ('"+hex_md5(account.id+userInfo._key)+"','"+
            subscriber.openid+"','"+
            subscriber.brokerId+"','"+
            subscriber.nickname+"','"+
            subscriber.avatarUrl+"','"+
            userInfo._key+"','"+
            userInfo.nickname+"','"+
            userInfo.avatarUrl+"','"+
            account.id+"','"+
            account.name+"','"+
            account.originalId+"',"+
            subscriber.points+",'"+groupingCode+"',now())",
        type:"post",
        //data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },         
        success:function(json){
            console.log("===subscribes inserted===\n",json);
            //从当前列表中删除该文章
            $("#pendingAccountQrcode").empty();//清除二维码图片
            $("div[data='"+account.id+"']").remove();
        }
    });     
}


//显示发布公众号表单
function showAccountForm(){
    console.log("show account form.");
    //判断阅豆是否足够：
    if(broker&&broker.points<10){
        siiimpleToast.message('阅豆不足，发布需要10阅豆，去阅读或关注获取吧~~',{
              position: 'bottom|center'
            });
    }else{//根据是否有已发布公众号判断如何处理
        console.log("found exists accounts.",$("div[id^=btnPublish_]").length);
        if($("button[id^=btnPublish_]").length==0){//之前没有发布公众号。仅显示新增表单，不显示选择列表
            $("#hasAccountTitleDiv").css("display","none");
            //显示数据填报表单
            $.blockUI({ message: $('#accountform'),
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
        }else if($("button[id^=btnPublish_]").length==1){//直接添加完事
            console.log("add exist account to grouping.");
            var selectedItem = {
                id:$("button[id^=btnPublish_]").attr("id").replace(/btnPublish_/g,""),
                name:$("button[id^=btnPublish_]").attr("data-name"),
                originalId:$("button[id^=btnPublish_]").attr("data-originid"),
                updateDate:$("button[id^=btnPublish_]").attr("data-updateDate")
            }
            //加入grouping
            groupingItem(selectedItem);
            //显示到待阅文章列表内
            toppingItem(selectedItem);
        }else{//从已有的 里面选择 ，不显示新增表单
            $("#newAccountTitleDiv").css("display","none");
            $("#newAccountFormDiv").css("display","none");
            //显示数据填报表单
            $.blockUI({ message: $('#accountform'),
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

        //注册事件
        $("#btnCancel").click(function(){       
            $.unblockUI(); //直接取消即可
        });
        $("#btnPublish").click(function(){//发布公众号
            if(!$("#accountName").val() || $("#accountName").val().trim().length==0){
                $("#accountName").css("border","1px solid red");
                $("#accountName").val("");//清空原有数值，避免交叉
            }else if(!isOriginalIdValid($("#accountOriginalId").val())){
                $("#accountOriginalId").css("border","1px solid red");
                $("#accountOriginalId").val("");//清空原有数值，避免交叉
            }else{
                console.log("try to submit subscribe event.");
                submitAccount();
            }
        });
    }
}

//判定公众号原始ID是否正确
function isOriginalIdValid(originalId) {
	console.log("originalId",originalId);
	return true;
	//对于更改微信号的，不符合gh_xxxx格式
    //return /gh_[a-zA-Z0-9]+/i.test(originalId);
}

//添加公众号：获取名称、描述、原始ID
function submitAccount(){
    var originalId = $("#accountOriginalId").val().trim();
    $("#accountOriginalId").css("border","1px solid silver");//恢复标准风格
    var name = $("#accountName").val().trim();
    $("#accountName").css("border","1px solid silver");//恢复标准风格
    var desc = $("#accountDesc").val().trim()+"";
    $("#accountDesc").css("border","1px solid silver");//恢复标准风格       
    if(!broker){//如果broker不存在，则传递openid，后台会默认创建
        broker = {
            openid:userInfo._key,
            nickname:userInfo.nickName?userInfo.nickName:""
        };
    }else if(!broker.id){//如果没有id，也设置openid
        broker.openid = userInfo._key;
        broker.nickname = userInfo.nickName?userInfo.nickName:"";
    }
    $.ajax({
        url:app.config.sx_api+"/wx/wxAccount/rest/account",
        type:"post",
        data:JSON.stringify({
            name:name,
            description:desc,
            originalId:originalId,
            qrcodeImg:"https://open.weixin.qq.com/qr/code?username="+originalId,
            broker:broker,
        }),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },        
        success:function(res){
            console.log("account submit succeed.",res);
            $.unblockUI(); //屏幕解锁
            //清空数据
            $("#accountOriginalId").val("");//清空原有数值，避免交叉
            $("#accountName").val("");//清空原有数值，避免交叉   
            $("#accountDesc").val("");//清空原有数值，避免交叉          
            //将公众号显示在自己列表顶部
            if(res.status){//提示文章已发布
                if(res.code&&res.code=="duplicate"){
                    //添加到班车列表 
                    groupingItem(res.data);                    
                }else{
                    toppingItem(res.data);//将文章显示到界面
                    //扣除阅豆，并更新当前阅豆数
                    if(broker&&broker.points&&res.points){
                        broker.points = broker.points-res.points;
                        insertBroker(broker);
                    }    
                    //添加到班车列表 
                    groupingItem(res.data);                  

                }   
            }      
        }
    })     
}


//将公众号加入班车列表
function groupingItem(item){
    $.ajax({
        url:app.config.sx_api+"/wx/wxGrouping/rest/grouping",
        type:"post",
        data:JSON.stringify({
            code:groupingCode,
            timeFrom:timeFrom,
            timeTo:timeTo,
            subjectType:'account',
            subjectId: item.id
        }),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },        
        success:function(res){
            console.log("submit account to wxgroup succeed.",res);
            //隐藏添加文章按钮：一个班车只允许一个人添加一篇文章
            $("#createAccountEntry").css("display","none");
            $("#createAccountBtn").css("display","none");
            $("#blankGroupingTips").css("display","none");//隐藏提示
            siiimpleToast.message('亲，公众号已加入，进入列表关注吧~~',{
                  position: 'bottom|center'
                });     
        }
    }) 
}


//手动置顶
function toppingItem(item){
    if(!item || !item.id){
        console.log("wrong account");
        return;
    }
    //文章无logo，随机指定一个。设置为发布者LOGO，或者直接忽略
    logo = "https://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg";
    //直接根据originalId显示缩略图
    if(item.originalId){
        logo = "https://open.weixin.qq.com/qr/code?username="+item.originalId;
    }

    //新文章默认显示到顶部：仅在发布者界面
    var tags = "<span style='margin-right:5px;padding:0 2px;border:1px solid red;color:red;border-radius:5px;font-size:12px;line-height:16px;'>我自己的</span>";
    var advertise = "";

    var title = "<div class='title'>"+tags+item.name+advertise+"</div>";
    var imageBg = "<div id='qrcodeimg"+item.id+"' class='qrcodeimg'></div>";
    var description = "<div class='description'>"+(item.description?item.description:"")+"</div>";
    var pubishDate = "<div class='description'>"+item.updateDate+"</div>";

    var btns = "<div class='btns'><div id='article-"+item.id+"' data-id='"+item.id+"'>前往关注</div></div>";

    $("#createAccountEntry").after("<li><div class='task' data='"+item.id+"' data-title='"+item.name+"' data-originid='"+item.originalId+"' data-url='"+logo+"'><div class='task-logo'>" + imageBg +"</div><div class='task-tags'>" +title +description+pubishDate+"</div></li>");

    //设置背景图片
    $("#qrcodeimg"+item.id).css("background-image","url("+logo+")");

    //注册事件
    /**
    $("div[data='"+item.id+"']").click(function(){
        //cookie缓存记录当前浏览文章，返回时检查
        console.log("Publisher::Accounts now jump to account.");
        var expDate = new Date();
        expDate.setTime(expDate.getTime() + (60 * 1000)); // 60秒钟后自动失效：避免用户直接叉掉页面不再回来    
        var pendingAccount = {
            id:$(this).attr("data"),//id
            name:$(this).attr("data-title"),//标题
            originalId:$(this).attr("data-originid"),//公众号ID
            startTime: new Date().getTime()//开始时间戳：需要超过10秒
        };
               
        console.log("Publisher::Accounts save account to cookie.",pendingAccount);
        $.cookie('sxAccount', JSON.stringify(pendingAccount), { expires: expDate, path: '/' });  //把浏览中的id写入cookie便于记录阅读数       

        //显示二维码供扫描关注
        console.log("Publisher::Accounts now show QRcode.");
        $("#pendingAccountQrcode").append("<img src='"+$(this).attr("data-url")+"' width='200' height='200'/>");        

    });
    //**/

   //注册事件
    $("div[data='"+item.id+"']").click(function(){
        //cookie缓存记录当前浏览文章，返回时检查
        console.log("Publisher::Accounts now jump to account.");
        var expDate = new Date();
        expDate.setTime(expDate.getTime() + (60 * 1000)); // 60秒钟后自动失效：避免用户直接叉掉页面不再回来    
        var pendingAccount = {
            id:$(this).attr("data"),//id
            name:$(this).attr("data-title"),//标题
            originalId:$(this).attr("data-originid"),//公众号ID
            startTime: new Date().getTime()//开始时间戳：需要超过10秒
        };
               
        console.log("Publisher::Accounts save account to cookie.",pendingAccount);
        $.cookie('sxAccount', JSON.stringify(pendingAccount), { expires: expDate, path: '/' });  //把浏览中的id写入cookie便于记录阅读数       

        //显示二维码供扫描关注
        console.log("Publisher::Accounts now show QRcode.");
        $("#pendingAccountQrcode").append("<img src='"+$(this).attr("data-url")+"' width='200' height='200'/>");    
        //二维码长按事件：模拟关注，在等待1.5秒后显示确认按钮
        setTimeout(function(){
            $("#btnYesSubscribe").css("display","block");
        },3200);
        
        //显示二维码
        $.blockUI({ message: $('#qrcodeform'),
            css:{ 
                padding:        10, 
                margin:         0, 
                width:          '80%', 
                top:            '10%', 
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

    });

}


//分享到微信群：直接构建互阅班车，便于统计结果
function registerShareHandler(){
    //准备分享url
    //var startTime = new  Date().getTime();
    var shareUrl = window.location.href;//.replace(/articles/g,"articles-grouping");//目标页面将检查是否关注与注册
    //shareUrl += "?code="+groupingCode;//code
    //shareUrl += "&timeFrom="+timeFrom;//默认从当前时间开始
    //shareUrl += "&timeTo="+timeTo;//默认1小时结束

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
                    title:groupingName,//"加入列表，我们来一起互关吧", // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:"https://www.biglistoflittlethings.com/static/logo/grouping/subscribe.png", // 分享图标
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
                    title:groupingName,//"加入列表，我们来一起互关吧", // 分享标题
                    desc:groupingDesc,//"添加公众号加入，关注后确认，结果自动统计", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: "https://www.biglistoflittlethings.com/static/logo/grouping/subscribe.png", // 分享图标
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
