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

    $("body").css("background-color","#fff");//更改body背景为白色

    //加载达人信息
    loadBrokerInfo();

    loadPerson(currentPerson);//加载用户

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
    resultCheck();

});

//解决返回时不重新加载问题
window.onpageshow = function (event) {
    siiimpleToast.message('关注后返回：'+event.persisted,{
          position: 'bottom|center'
        });      
    if (event.persisted) {
        window.location.reload()
    }
} 

util.getUserInfo();//从本地加载cookie

var byOpenid = null;
var byPublisherOpenid = null;

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
    util.AJAX(app.config.sx_api+"/wx/wxAccount/rest/pending-accounts", function (res) {
        showloading(false);
        console.log("Publisher::Accounts::loadItems try to retrive pending accounts.", res)
        if(res && res.length==0){//如果没有画像则提示，
            shownomore();
            if(!items || items.length==0){
                $("#Center").append("<div style='font-size:12px;line-height:24px;width:100%;text-align:center;'>没有待粉公众号哦~~</div>");
            }         
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

//关注完成后提交并扣除阅豆
function submitResult(){
    var accountInfo = $.cookie('sxAccount');
    console.log("load accountInfo from cookie.",accountInfo);
    if(accountInfo && accountInfo.trim().length>0){
        console.log("get accountInfo info from cookie.",accountInfo);
        var account = JSON.parse(accountInfo);
        console.log("try to submit subscribe event.");
        $.cookie('sxAccount', "", { path: '/' }); //清除cookie重新来过
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
        $("#btnNoSubscribe").css("display","block");
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
            subscriber.points+",now())",
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
    }else{      
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
                    siiimpleToast.message('公众号已存在，不需要重复发布哦~~',{
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
    var tags = "<span style='margin-right:5px;padding:0 2px;border:1px solid red;color:red;border-radius:5px;font-size:12px;line-height:16px;'>新公众号首发</span>";
    var advertise = "";

    var title = "<div class='title'>"+tags+item.name+advertise+"</div>";
    var imageBg = "<div id='qrcodeimg"+item.id+"' class='qrcodeimg'></div>";
    var description = "<div class='description'>"+item.description+"</div>";
    var pubishDate = "<div class='description'>"+item.updateDate+"</div>";

    var btns = "<div class='btns'><div id='article-"+item.id+"' data-id='"+item.id+"'>前往关注</div></div>";

    $("#createAccountEntry").after("<li><div class='task' data='"+item.id+"' data-title='"+item.name+"' data-originid='"+item.originalId+"' data-url='"+logo+"'><div class='task-logo'>" + imageBg +"</div><div class='task-tags'>" +title +description+pubishDate+"</div></li>");

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

    });
}

