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
    //支持整个列表组队互阅
    if(args["code"]){
        groupingCode = args["code"]; //支持传入班车code
    }else{
        groupingCode = generateShortCode(new Date().getFullYear()+"-"+(new Date().getMonth()+1)+"-"+new Date().getDate());//TODO：需要生成当天的互阅班车号
    }          
    if(args["timeFrom"]){
        timeFrom = args["timeFrom"]; //班车开始时间
    }else{
        timeFrom = new Date().getTime();//否则为当前时间
    }
    if(args["timeTo"]){
        timeTo = args["timeTo"]; //班车结束时间
    }else{
        timeTo = timeFrom + 24*60*60*1000;//否则为当前时间持续1天
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
    $("#createArticleBtn").click(function(e){
        showArticleForm();
    });

    //注册互阅开车事件
    $("#groupingArticleLink").click(function(e){
        //显示发车表单
        showGroupingForm();
    });
    
    //取消充值
    $("#btnCancelCharge").click(function(e){
        $.unblockUI(); 
    });  
    
    //检查是否有缓存事件
    resultCheck();

    //注册分享事件
    registerShareHandler();

    //显示能量球
    checkReadingRecords();

    //判断是否从班车页面进入：从合集或合集报告界面接入都计算在内：暂未启用：也对导致由于进入大厅的人少，班车中出现很多个只有一个阅读的情况
    /**
    if (document.referrer && (document.referrer.indexOf("articles-grouping")>=0 || document.referrer.indexOf("report-grouping")>=0 )  && document.referrer.indexOf("code")>=0 ) {
        // 表示从班车列表而来
        var regexp = /code=[0-9A-Za-z]{6}/g;
        const referGroupingCode = document.referrer.match(regexp)[0].replace(/code=/g,"");
        console.log("got referGroupingCode.",referGroupingCode);
    } 
    //**/   

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

var referGroupingCode = '';//记录是否从班车跳转到大厅，如果是，从大厅阅读文章也加入班车。默认为空，表示从大厅阅读

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

var currentActionType = '';//当前操作类型
var tagging = '';//操作对应的action 如buy view like 等

var currentPerson = app.globalData.userInfo?app.globalData.userInfo._key:null;
var userInfo=app.globalData.userInfo;//默认为当前用户

var currentBroker = null;
var broker = {};//当前达人

var sxTimer = null;
var sxStartTimestamp=new Date().getTime();//定时器如果超过2分
var sxLoopCount = 1000;//定时器运行100次即停止，即30秒

var remainCount = 1;//默认可以接着读
var remainCountTips = "一会儿";//提示文字
function checkReadingRecords(articleId){//传递articleId时将自动添加到列表
    var readingRecords = {};//记录当前阅读记录：仅存储距今1小时的记录，通过cookie缓存。存储的是articleId:timestamp，其中timestamp为long型
    var oldestTimestamp = new Date().getTime();//记录当前阅读记录中时间最久的那一个，用于计算需要休息多久恢复阅读
    
    //首先读取缓存
    var readingRecordsInfo = $.cookie('sxReadingRecord');
    console.log("load readingRecordsInfo from cookie.",readingRecordsInfo);
    if(readingRecordsInfo && readingRecordsInfo.trim().length>0){
        readingRecords = JSON.parse(readingRecordsInfo);
    }  

    //根据时间检查是否超时，得到新的列表
    Object.keys(readingRecords).forEach(function(key){
        var ts = readingRecords[key];
        if(new Date().getTime()-ts>60*60*1000){//如果该记录距今超过1小时，则删除
            delete readingRecords[key];
        }else{//找到并设置最老的哪一个
            if(ts<oldestTimestamp)oldestTimestamp=ts;//用最老的那一条
        }
    });

    //如果传递新articleId 则加入
    if(articleId && articleId.trim().length>0)
        readingRecords[articleId] = new Date().getTime();

    //写入cookie
    var expDate = new Date();
    expDate.setTime(expDate.getTime() + (60 * 60 * 1000)); // 60分钟后自动失效：避免用户长时间不回来  
    $.cookie('sxReadingRecord', JSON.stringify(readingRecords), { expires: expDate, path: '/' });  //1小时自动失效 

    //得到剩余条数：默认为20条
    remainCount = 20 - Object.keys(readingRecords).length;
    var remainRatio = remainCount*5;//remainCount*100/20

    //更新界面能量球
    console.log("try to update energy ball.",remainCount,remainRatio);
    if(remainRatio>70){
        $("#energy-ball").css("border","1px solid #32cd32");
        $("#wave").css("border","1px solid #32cd32");
        $("#wave").css("background-color","#32cd32");
        $("#wave-tip").text(remainCount+" / 20");
        $("div[class^=g-wave]").each(function(){
            var oldClass = $(this).attr("class");
            $(this).removeClass(oldClass);
            $(this).addClass("g-wave100");
        });
    }else if(remainRatio>40){
        $("#energy-ball").css("border","1px solid #00ffa1");
        $("#wave").css("border","1px solid #00ffa1");
        $("#wave").css("background-color","#00ffa1");
        $("#wave-tip").text(remainCount+" / 20");
        $("div[class^=g-wave]").each(function(){
            var oldClass = $(this).attr("class");
            $(this).removeClass(oldClass);
            $(this).addClass("g-wave70");
        });
    }else if(remainRatio>20){
        $("#energy-ball").css("border","1px solid #46ffa5");
        $("#wave").css("border","1px solid #46ffa5");
        $("#wave").css("background-color","#46ffa5");
        $("#wave-tip").text(remainCount+" / 20");
        $("div[class^=g-wave]").each(function(){
            var oldClass = $(this).attr("class");
            $(this).removeClass(oldClass);
            $(this).addClass("g-wave40");
        });
    }else if(remainRatio>10){
        $("#energy-ball").css("border","1px solid #e3ff00");
        $("#wave").css("border","1px solid #e3ff00");
        $("#wave").css("background-color","#e3ff00");
        $("#wave-tip").text(remainCount+" / 20");
        $("#wave-tip").css("color","silver");
        $("div[class^=g-wave]").each(function(){
            var oldClass = $(this).attr("class");
            $(this).removeClass(oldClass);
            $(this).addClass("g-wave20");
        });
    }else if(remainRatio>=5){
        $("#energy-ball").css("border","1px solid #ff1601");
        $("#wave").css("border","1px solid #ff1601");
        $("#wave").css("background-color","#ff1601");
        $("#wave-tip").text(remainCount+" / 20");
        $("#wave-tip").css("color","silver");
        $("div[class^=g-wave]").each(function(){
            var oldClass = $(this).attr("class");
            $(this).removeClass(oldClass);
            $(this).addClass("g-wave10");
        });
    }else{
        //计算恢复时间
        var pauseTime = 60*60*1000-(new Date().getTime()-oldestTimestamp);
        var pauseMinutes = Math.floor(pauseTime/1000/60/10*10);//以10分钟为单位
        if(pauseMinutes<=0)pauseMinutes=1;
        remainCountTips = pauseMinutes+"分钟";

        $("#energy-ball").css("border","1px solid silver");
        $("#wave").css("border","1px solid silver");
        $("#wave").css("background-color","#32cd32");
        $("#wave-tip").text("休息"+pauseMinutes+"分钟");
        $("#wave-tip").css("color","silver");
        $("#wave-tip").css("font-size","12px");
        $("div[class^=g-wave]").each(function(){
            var oldClass = $(this).attr("class");
            $(this).removeClass(oldClass);
            $(this).addClass("g-wave0");
        });
    }
    
}

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
                var state = "publisher__articles___code="+groupingCode+"__timeFrom="+timeFrom+"__timeTo="+timeTo;
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
                var state = "publisher__articles___code="+groupingCode+"__timeFrom="+timeFrom+"__timeTo="+timeTo;
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
  console.log("loadBrokerInfo got result.",broker,currentBroker);
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
var tmpArticleIds = [];//缓存已加载的文章ID，避免置顶文章与普通文章重复显示
function loadItems(){
    util.AJAX(app.config.sx_api+"/wx/wxArticle/rest/pending-articles", function (res) {
        showloading(false);
        console.log("Publisher::Articles::loadItems try to retrive pending articles.", res)
        if(res && res.length==0){//如果没有画像则提示，
            shownomore();
            if(!items || items.length==0){
                $("#Center").append("<div style='font-size:12px;line-height:24px;width:100%;text-align:center;'>没有待阅文章哦~~</div>");
            }            
        }else{//否则显示到页面
            //更新当前翻页
            page.current = page.current + 1;
            //装载具体条目
            var hits = res;
            for(var i = 0 ; i < hits.length ; i++){
                //items.push(hits[i]);
                if(tmpArticleIds.indexOf(hits[i].id)<0){
                    items.push(hits[i]);
                    tmpArticleIds.push(hits[i].id);
                }else{
                    //ignore
                }
            }
            insertItem();
        }
    }, 
    "GET",
    {
        from:(page.current+1)*page.size,
        to:(page.current+1)*page.size+page.size,
        openid:byOpenid?byOpenid:userInfo._key,//当前订阅者的openid：用于排除已经关注的内容
        publisherOpenid:byPublisherOpenid?byPublisherOpenid:""//发布者 openid：只显示指定发布者的内容
    },
    {});
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
    //由于微信禁止，无法直接使用封面图，需要使用达人图片
    /**
    if(item.coverImg){
        logo = item.coverImg;
    }
    //**/
    //判断有无置顶广告位
    var tags = "";
    var advertise = "";
    if(item.status&&item.status>1){//如果有广告位则显示置顶
        tags += "<span style='margin-right:5px;padding:0 2px;border:1px solid red;color:red;border-radius:5px;font-size:12px;line-height:16px;'>无敌置顶</span>";
        advertise = "<img src='https://www.biglistoflittlethings.com/ilife-web-wx/images/rocket.png' width='16' height='16'/>&nbsp;";
    }else if(item.status&&item.status>0){//临时置顶
        tags += "<span style='margin-right:5px;padding:0 2px;border:1px solid red;color:red;border-radius:5px;font-size:12px;line-height:16px;'>顶一下</span>";
    }
    
    var title = "<div class='title'>"+tags+item.title/*+(item.counts?"("+item.counts+"阅)":"")*/+advertise+"</div>";
    var image = "<img src='"+logo+"' style='width:60px;object-fit:cover;'/>";
    var description = "<div class='description'>"+item.updateDate+"</div>";

    var btns = "<div class='btns'><div id='article-"+item.id+"' data-id='"+item.id+"'>前往批阅</div></div>";

    $("#waterfall").append("<li><div class='task' data='"+item.id+"' data-title='"+item.title+"' data-url='"+item.url+"'><div class='task-logo'>" + image +"</div><div class='task-tags'>" +title +description+"</div></li>");
    num++;

    //注册事件
    $("div[data='"+item.id+"']").click(function(){
        //检查能量值
        if(remainCount<1){//提示休息：
            siiimpleToast.message('亲，喝口水，等'+remainCountTips+'再来吧~~',{
                  position: 'bottom|center'
                });
        }else{
            //cookie缓存记录当前浏览文章，返回时检查
            console.log("Publisher::Articles now jump to article.");
            var expDate = new Date();
            expDate.setTime(expDate.getTime() + (5 * 60 * 1000)); // 5分钟后自动失效：避免用户直接叉掉页面不再回来    
            var readingArticle = {
                id:$(this).attr("data"),//文章id
                title:$(this).attr("data-title"),//文章标题
                url:$(this).attr("data-url"),//文章URL
                startTime: new Date().getTime()//开始时间戳：需要超过10秒
            };
                   
            console.log("Publisher::Articles save article to cookie.",readingArticle);
            $.cookie('sxArticle', JSON.stringify(readingArticle), { expires: expDate, path: '/' });  //把浏览中的文章id写入cookie便于记录阅读数       

            //跳转到原始页面完成阅读
            console.log("Publisher::Articles now jump to article.");
            //window.location.href = "../index.html";   
            window.location.href = $(this).attr("data-url");    
        }      

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
            //显示阅豆不足警告
            if(res.data.points<-2)
                $("#tipsDiv").html("<div class='blink' style='color:red;font-size:14px;font-weight:bold;line-height:20px;width:100%;'>阅豆低于-2，文章将不在大厅展示<br/>请阅读或关注获取阅豆吧~~</div>");//显示提示信息：如果阅豆不足则提示

            registerTimer(res.data.id);//加载该达人的board列表
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

//检查阅读效果：如果检查到有cookie，则显示阅读数确认框
function resultCheck(){
    var articleInfo = $.cookie('sxArticle');
    console.log("load articleInfo from cookie.",articleInfo);
    if(articleInfo && articleInfo.trim().length>0){
        console.log("get articleInfo info from cookie.",articleInfo);
        var article = JSON.parse(articleInfo);
        //检查时间是否已达到10秒
        var duration = new Date().getTime() - Number(article.startTime);
        if( duration > 10000){
            //显示数据填报表单
            $.blockUI({ message: $('#checkform'),
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
            $("#btnNo").click(function(){
                $.cookie('sxArticle', "", { path: '/' }); //清除cookie重新来过
                $.unblockUI(); 
            });
            $("#btnYes").click(function(){//完成阅读后的奖励操作
                //加入阅读列表
                checkReadingRecords(article.id);                
                //检查数字：必填。TODO：此处需要判断是否胡乱填报
                var readCount = Number($("#viewNumbers").val());
                if(readCount <=0 ){
                    $("#viewNumbers").css("border","1px solid red");
                }else{
                    console.log("try to submit read event.");
                    $.cookie('sxArticle', "", { path: '/' }); //清除cookie重新来过
                    costPoints(article);
                }
            });
        }else{//提示超过10秒才可以
            console.log("不到10秒，不能奖励",duration/1000);
            siiimpleToast.message('亲，要超过10秒才能奖励阅豆哦~~',{
                  position: 'bottom|center'
                });
            //清除cookie重新来过
            $.cookie('sxArticle', "", { path: '/' });  
        }
    }else{
      console.log("no article from cookie.",articleInfo);
    }
}

//完成阅读扣除及奖励
function costPoints(article){
    //先扣除阅豆
    console.log("try to commit read event.",userInfo._key);
    $.ajax({
        url:app.config.sx_api+"/wx/wxArticle/rest/exposure",
        type:"post",
        data:JSON.stringify({
            articleId:article.id,
            readerOpenid:userInfo._key,
            readCount:$("#viewNumbers").val().trim()
        }),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },         
        success:function(res){
            console.log("cost point succeed.",res);
            logPointCostEvent(article,res);//记录本次阅读历史
            //解除屏幕锁屏
            $.unblockUI(); 
            //扣除阅豆，并更新当前阅豆数
            if(broker&&broker.points&&res.points){
                broker.points = broker.points+res.points;
                insertBroker(broker);
            }             
            //提示阅读已完成
            siiimpleToast.message('已奖励'+res.points+'阅豆，读过的文章将不再显示哦~~',{
                  position: 'bottom|center'
                });            
        }
    })      
}

//记录文章阅读历史：publisher内包含有文章发布者信息：openid,brokerId,nickname,avatarUrl 消耗的点数points
//需要补全：阅读者openid，nickname，avatarUrl，阅读时间，阅读报数，文章ID
//记录ID为：文章ID+阅读者openid md5
function logPointCostEvent(article,publisher){
    var readCount = Number($("#viewNumbers").val());
    $("#viewNumbers").css("border","1px solid silver");//恢复标准风格
    $("#viewNumbers").val("");//清空原有数值，避免交叉
    $.ajax({
        url:app.config.analyze_api+"?query=insert into ilife.reads values ('"+hex_md5(article.id+userInfo._key)+"','"+
            publisher.openid+"','"+
            publisher.brokerId+"','"+
            publisher.nickname+"','"+
            publisher.avatarUrl+"','"+
            userInfo._key+"','"+
            userInfo.nickname+"','"+
            userInfo.avatarUrl+"','"+
            article.id+"','"+
            article.title+"','"+
            article.url+"',"+
            publisher.points+","+readCount+",'"+referGroupingCode+"',now())",
        type:"post",
        //data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },         
        success:function(json){
            console.log("===reads inserted===\n",json);
            //从当前列表中删除该文章
            $("div[data='"+article.id+"']").remove();
        }
    });     
}


//显示文章互阅表单
function showGroupingForm(){
    console.log("show grouping form.");

    //显示数据填报表单
    $.blockUI({ message: $('#groupingform'),
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
    $("#btnGroupingNo").click(function(){
        $("#groupingName").val("");//清空原有数值，避免交叉 
        $("#groupingDesc").val("");//清空原有数值，避免交叉        
        $.unblockUI(); //直接取消即可
    });
    $("#btnGroupingYes").click(function(){//完成阅读后的奖励操作
        var groupingName = $("#groupingName").val();
        if(!groupingName||groupingName.trim().length==0){
            groupingName = new Date().getFullYear()+"-"+(new Date().getMonth()+1)+"-"+new Date().getDate()+" 互阅专车";
        }
        var groupingDesc = $("#groupingDesc").val();
        if(!groupingDesc||groupingDesc.trim().length==0){
            groupingDesc = "发文上车，10秒有效阅读，结果自动统计";
        }   
        $("#groupingName").val("");//清空原有数值，避免交叉 
        $("#groupingDesc").val("");//清空原有数值，避免交叉                
        window.location.href = "articles-grouping.html?code="+generateShortCode(getUUID())+"&groupingName="+groupingName+"&groupingCode="+groupingDesc;
    });

}



//显示发布文章表单
function showArticleForm(){
    console.log("show article form.");
    //判断阅豆是否足够：
    if(broker&&broker.status=='disabled'){
        siiimpleToast.message('抱歉，你的账户出现异常，请与我们联系~~',{
              position: 'bottom|center'
            });
    }else if(broker&&broker.points<5){
        siiimpleToast.message('阅豆不足，发布文章需要5阅豆，去阅读或关注获取吧~~',{
              position: 'bottom|center'
            });
    }else{    
        //显示数据填报表单
        $.blockUI({ message: $('#articleform'),
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
        $("#btnCancel").click(function(){
            $("#articleUrl").css("border","1px solid silver");//恢复标准风格
            $("#articleUrl").val("");//清空原有数值，避免交叉        
            $.unblockUI(); //直接取消即可
        });
        $("#btnPublish").click(function(){//完成阅读后的奖励操作
            //检查数字url，胡乱填写不可以
            if( !isUrlValid($("#articleUrl").val()) ){
                $("#articleUrl").css("border","1px solid red");
                $("#articleUrl").val("");//清空原有数值，避免交叉
                siiimpleToast.message('当前仅支持微信文章链接~~',{
                  position: 'bottom|center'
                });                 
            }else{
                console.log("try to submit read event.");
                submitArticle();
            }
        });
    }
}

//检查url是否符合要求：仅支持微信公众号文章
//https://mp\.weixin\.qq\.com/s/[-a-zA-Z0-9+&@#/%?=~_|!:,.;]*[-a-zA-Z0-9+&@#/%=~_|]
/**
function isUrlValid(url) {
    return /^(https?|s?ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i.test(url);
}
//**/
function isUrlValid(url) {
    //仅支持短连接，不支持带参数的长链接
    if(url&&url.trim().length>0){
        url = url.split("?")[0];
    }
    return /^https:\/\/mp\.weixin\.qq\.com\/s\/[-a-zA-Z0-9+&@#/%?=~_|!:,.;]*[-a-zA-Z0-9+&@#/%=~_|]$/i.test(url);
}

//添加文章：获取文章url并提交
function submitArticle(){
    var url = $("#articleUrl").val();
    $("#articleUrl").css("border","1px solid silver");//恢复标准风格
    $("#articleUrl").val("");//清空原有数值，避免交叉
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
        url:app.config.sx_api+"/wx/wxArticle/rest/article",
        type:"post",
        data:JSON.stringify({
            url:url,
            broker:broker,
        }),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },        
        success:function(res){
            console.log("article submit succeed.",res);
            $.unblockUI(); //屏幕解锁
            //将文章显示在自己列表顶部
            if(res.status){//提示文章已发布
                if(res.code&&res.code=="duplicate"){
                    siiimpleToast.message('文章已存在，不需要重复发布哦~~',{
                          position: 'bottom|center'
                        });  
                }else{
                    toppingItem(res.data);//将文章显示到界面
                    //扣除阅豆，并更新当前阅豆数
                    if(broker&&broker.points&&res.points){
                        broker.points = broker.points-res.points;
                        insertBroker(broker);
                    }                     
                    siiimpleToast.message('发布成功，消耗'+res.points+'阅豆。阅豆越多排名越靠前哦~~',{
                          position: 'bottom|center'
                        });  
                }   
            }      
        }
    })     
}

//手动置顶指定文章
function toppingItem(item){
    if(!item || !item.id){
        console.log("wrong article");
        return;
    }
    //文章无logo，随机指定一个。设置为发布者LOGO，或者直接忽略
    logo = "https://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg";
    //由于微信禁止，无法直接使用封面图，需要使用达人图片
    /**
    if(item.coverImg){
        logo = item.coverImg;
    }
    //**/
    //新文章默认显示到顶部：仅在发布者界面
    var tags = "<span style='margin-right:5px;padding:0 2px;border:1px solid red;color:red;border-radius:5px;font-size:12px;line-height:16px;'>新文首发</span>";
    var advertise = "";

    var title = "<div class='title'>"+tags+item.title+advertise+"</div>";
    var image = "<img src='"+logo+"' style='width:60px;object-fit:cover;'/>";
    var description = "<div class='description'>"+item.updateDate+"</div>";

    var btns = "<div class='btns'><div id='article-"+item.id+"' data-id='"+item.id+"'>前往批阅</div></div>";

    $("#createArtileEntry").after("<li><div class='task' data='"+item.id+"' data-title='"+item.title+"' data-url='"+item.url+"'><div class='task-logo'>" + image +"</div><div class='task-tags'>" +title +description+"</div></li>");

    //注册事件
    $("div[data='"+item.id+"']").click(function(){
        //cookie缓存记录当前浏览文章，返回时检查
        console.log("Publisher::Articles now jump to article.");
        var expDate = new Date();
        expDate.setTime(expDate.getTime() + (5 * 60 * 1000)); // 5分钟后自动失效：避免用户直接叉掉页面不再回来    
        var readingArticle = {
            id:$(this).attr("data"),//文章id
            title:$(this).attr("data-title"),//文章标题
            url:$(this).attr("data-url"),//文章URL
            startTime: new Date().getTime()//开始时间戳：需要超过10秒
        };
               
        console.log("Publisher::Articles save article to cookie.",readingArticle);
        $.cookie('sxArticle', JSON.stringify(readingArticle), { expires: expDate, path: '/' });  //把浏览中的文章id写入cookie便于记录阅读数       

        //跳转到原始页面完成阅读
        console.log("Publisher::Articles now jump to article.");
        //window.location.href = "../index.html";   
        window.location.href = $(this).attr("data-url");          

    });
}

//分享到微信群：直接构建互阅班车，便于统计结果
function registerShareHandler(){
    //准备分享url
    var startTime = new  Date().getTime();
    var shareUrl = window.location.href;//.replace(/articles/g,"articles-grouping");//目标页面将检查是否关注与注册
    shareUrl += "?code="+generateShortCode(getUUID());//临时生成code
    shareUrl += "&timeFrom="+startTime;//默认从当前时间开始
    shareUrl += "&timeTo="+(startTime + 60*60*1000);//默认1小时结束

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
                    title:"把文章加入合集，让更多人看到", // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:"https://www.biglistoflittlethings.com/static/logo/grouping/default.png", // 分享图标
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
                    title:"把文章加入合集，让更多人看到", // 分享标题
                    desc:"发文进入，10秒有效阅读，结果自动统计", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: "https://www.biglistoflittlethings.com/static/logo/grouping/default.png", // 分享图标
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
