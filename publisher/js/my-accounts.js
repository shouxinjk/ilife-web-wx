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
        byOpenid = args["byOpenid"]; //支持传入publisherOpenid
    }    

    $("body").css("background-color","#fff");//更改body背景为白色

    //加载达人信息
    loadBrokerInfo();

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

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });

    //注册点击创建按钮事件 ：显示表单
    $("#createAccountBtn").click(function(e){
        showAccountForm();
    });
    //点击购买按钮：创建支付信息并发起微信支付
    $("#btnPurchase").click(function(e){
        createPayInfo();
    });
    //点击取消按钮：清空已选广告列表、清空已售列表、解除锁屏
    $("#btnQuitPurchase").click(function(e){
        clearAds();
        $.unblockUI(); 
    });   

    //取消临时置顶表单 
    $("#btnCancelPoorTopping").click(function(e){
        //清空html内容：每次需要动态生成
        $("#poorToppingDiv").empty();
        $.unblockUI(); 
    });
    //从临时置顶表单直接进入无敌置顶
    $("#btnOkUpcomingTopping1").click(function(e){
       $("#poorToppingDiv").empty();
        $.unblockUI(); 
        //显示购买表单：需要有时间间隔，否则会导致原有html元素被一并隐藏删除
        setTimeout(function(){loadSoldAds(toppingAccountId);},500);//继续沿用当前公众号ID
    });      

    //取消查看置顶明细
    $("#btnCancelUpcomingTopping").click(function(e){
        $("#upcomingToppingDiv").html('<div style="line-height: 30px;font-size: 12px;">没有待置顶记录哦，赶紧设置吧~~</div>');
        $.unblockUI(); 
    }); 
    //从置顶明细表单直接进入无敌置顶
    $("#btnOkUpcomingTopping2").click(function(e){
        $("#upcomingToppingDiv").html('<div style="line-height: 30px;font-size: 12px;">没有待置顶记录哦，赶紧设置吧~~</div>');
        $.unblockUI(); 
        //显示购买表单：需要有时间间隔，否则会导致原有html元素被一并隐藏删除
        setTimeout(function(){loadSoldAds(toppingAccountId);},500);//继续沿用当前公众号ID
    });    

    //取消查看报数明细
    $("#btnCancelSubscribes").click(function(e){
        $.unblockUI(); 
    }); 
    //从报数明细表单直接进入无敌置顶
    $("#btnOkSubscribes").click(function(e){
        $.unblockUI(); 
        //显示报数明细表单：需要有时间间隔，否则会导致原有html元素被一并隐藏删除
        setTimeout(function(){loadSoldAds(toppingAccountId);},500);//继续沿用当前公众号ID
    });   
    //取消查看开白明细
    $("#btnCancelForwards").click(function(e){
        $.unblockUI(); 
    });     

    //取消充值
    $("#btnCancelCharge").click(function(e){
        $.unblockUI(); 
    });                

    //检查是否有缓存事件
    resultCheck();

    //查询公众号总数及阅读总数
    countSubscribemeTotal();//查询关注总数
    countAccountTotal();//查询公众号总数

    //加载广告位：仅加载可用广告位
    loadAds();   

});

//解决返回时不重新加载问题
window.onpageshow = function (event) { 
    if (event.persisted) {
        window.location.reload()
    }
} 

util.getUserInfo();//从本地加载cookie

var byOpenid = null;

//设置默认logo
var logo = "https://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg";
var wxLogoPrefix = "https://open.weixin.qq.com/qr/code?username=";//微信公众号图片前缀

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
        //console.log("Accounts::registerTimer.");
        if ($(window).scrollTop() >= $(document).height() - $(window).height() - dist && !loading)
        {
            console.log("Accounts::registerTimer start load account.");
            // 表示开始加载
            loading = true;
            showloading(true);

            // 加载内容
            if(items.length < num){//如果内容未获取到本地则继续获取
                console.log("request accounts from server side.");
                //读取待阅读列表
                loadItems();
                //有用户操作则恢复计数器
                console.log("reset loop count.");
                sxLoopCount = 100;                
            }else{//否则使用本地内容填充
                console.log("insert account item from locale.");
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
根据当前用户openid加载已发布公众号列表：按照最后修改时间倒序排列
*/
function loadItems(){
    util.AJAX(app.config.sx_api+"/wx/wxAccount/rest/my-accounts/"+userInfo._key, function (res) {
        showloading(false);
        console.log("Publisher::Accounts::loadItems try to retrive my accounts.", res)
        if(res && res.length==0){//如果没有画像则提示，
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
    }, 
    "GET",
    {
        from:(page.current+1)*page.size,
        to:(page.current+1)*page.size+page.size
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

    //公众号无logo，随机指定一个。设置为发布者LOGO，或者直接忽略
    logo = "https://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg";
    //直接根据originalId显示缩略图
    if(item.originalId){
        logo = "https://open.weixin.qq.com/qr/code?username="+item.originalId.trim();
    }

    //判断有无置顶广告位
    var tags = "";
    if(item.advertise){//如果有广告位则显示置顶
        tags += "<span style='margin:2px auto;padding:2px;border:1px solid red;color:red;border-radius:16px;font-size:12px;line-height:20px;'>置顶</span>";
    }
    tags += "<span style='margin-right:5px;padding:0 2px;border:1px solid red;color:red;border-radius:5px;font-size:12px;line-height:16px;'>置顶</span>";
    var advertise = "<img src='https://www.biglistoflittlethings.com/ilife-web-wx/images/rocket.png' width='16' height='16'/>&nbsp;";

    var title = "<div class='title' id='title"+item.id+"'>"+item.name+(item.counts?"("+item.counts+"粉)":"")+"</div>";
    //var image = "<img src='"+logo+"' style='width:60px;object-fit:cover;'/>";
    var imageBg = "<div id='qrcodeimg"+item.id+"' class='qrcodeimg'></div>";
    var description = item.description&&item.description.trim().length>0?"<div class='description'>"+item.description+"</div>":"";
    var publishDate = "<div class='description'>"+item.updateDate+"</div>";

    var btns = "";
    //置顶：购买广告位
    btns += '<button type="submit" class="action-tag-orange" id="btnTopping'+item.id+'">置顶</button> ';   
    //顶一下：用阅豆临时置顶，时间10分钟
    btns += '<button type="submit" class="action-tag-orange" id="btnPoorTopping'+item.id+'">顶一下</button> ';      
    //上架、下架
    if(item.status=="active"){
        btns += '<button type="submit" class="action-tag-black" id="btnDeactive'+item.id+'">下架</button> ';
        btns += '<button type="submit" class="action-tag-orange" style="display:none" id="btnActive'+item.id+'">上架</button> ';
    }else{
        btns += '<button type="submit" class="action-tag-black" style="display:none" id="btnDeactive'+item.id+'">下架</button> ';
        btns += '<button type="submit" class="action-tag-orange" id="btnActive'+item.id+'">上架</button> ';
    }
    //置顶明细：弹出显示置顶明细列表，包括置顶及顶一下
    btns += '<button type="submit" class="action-tag-black" id="btnToppingHistory'+item.id+'">置顶明细</button> ';   
    //开白明细：弹出显示开白明细列表
    btns += '<button type="submit" class="action-tag-black" id="btnForwardList'+item.id+'">开白明细</button> ';           
    //关注明细：能够查看关注历史
    btns += '<button type="submit" class="action-tag-black" id="btnSubscribeHistory'+item.id+'">关注明细</button> ';     
    var btnsDiv = "<div class='btns' style='display:flex;flex-direction:row;flex-wrap:nowrap;margin-top:5px;'>"+btns+"</div>";    

    var seperator = "";
    if(num>1)
        seperator = "<div class='item-separator' style='border-radius:0'></div>";

    $("#waterfall").append("<li>"+seperator+"<div class='task' data='"+item.id+"' data-title='"+item.name+"' data-url='"+item.url+"'><div class='task-logo'>" + imageBg +"</div><div class='task-tags'>" +title +description+publishDate+btnsDiv+"</div></li>");
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
            title:$(this).attr("data-title"),//标题
            url:$(this).attr("data-url"),//文章URL
            startTime: new Date().getTime()//开始时间戳：需要超过10秒
        };
               
        console.log("Publisher::Accounts save account to cookie.",pendingAccount);
        $.cookie('sxAccount', JSON.stringify(pendingAccount), { expires: expDate, path: '/' });  //把浏览中的id写入cookie便于记录阅读数       

        //显示二维码供扫描关注
        console.log("Publisher::Accounts now show QRcode.");
        $("#pendingAccountQrcode").append("<img src='"+$(this).attr("data-url")+"' width='200' height='200'/>");        

    });

    //注册事件
    $("#btnDeactive"+item.id).click(function(){ //下架      
        changeAccountStatus($(this).attr("id").replace(/btnDeactive/,""),"inactive");
    });
    $("#btnActive"+item.id).click(function(){ //上架   
        changeAccountStatus($(this).attr("id").replace(/btnActive/,""),"active");
    });       
    $("#btnTopping"+item.id).click(function(){ //无敌置顶：要花钱的那种 
        loadSoldAds($(this).attr("id").replace(/btnTopping/,""));//需要传递当前公众号ID
    }); 
    $("#btnPoorTopping"+item.id).click(function(){ //临时置顶：不花钱的那种 
        showPoorToppingForm($(this).attr("id").replace(/btnPoorTopping/,""));//需要传递当前公众号ID
    }); 
    $("#btnToppingHistory"+item.id).click(function(){ //显示当前公众号的置顶明细
        showUpcomingToppings($(this).attr("id").replace(/btnToppingHistory/,""));//需要传递当前公众号ID
    });     
    $("#btnSubscribeHistory"+item.id).click(function(){ //显示当前公众号的报数明细
        loadSubscribes($(this).attr("id").replace(/btnSubscribeHistory/,""));//需要传递当前公众号ID
    });   
    $("#btnForwardList"+item.id).click(function(){ //显示开白请求明细 
        loadForwards($(this).attr("id").replace(/btnForwardList/,""));//需要传递当前公众号ID
    });             
    // 表示加载结束
    loading = false;
}

//修改公众号状态
function changeAccountStatus(accountId,status){
    console.log("try to change account status.",userInfo._key);
    $.ajax({
        url:app.config.sx_api+"/wx/wxAccount/rest/account/"+accountId+"/"+status,
        type:"post",
        success:function(res){
            console.log("status changed.",res);
            if(res.status){//修改按钮状态
                if(status=="active"){
                    $("#btnDeactive"+accountId).css("display","block");
                    $("#btnActive"+accountId).css("display","none");
                    siiimpleToast.message('已上架，阅豆越多排名越靠前哦~~',{
                          position: 'bottom|center'
                        });                    
                }else{
                    $("#btnDeactive"+accountId).css("display","none");
                    $("#btnActive"+accountId).css("display","block");
                    siiimpleToast.message('已下架，公众号将不再显示~~',{
                          position: 'bottom|center'
                        });                     
                }
            }
        }
    })   
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
    $("#brokerHint").empty();
    $("#brokerHint").append("阅豆: "+broker.points?broker.points:0+'&nbsp;<button type="submit" class="btnYes" id="btnCharge">购买阅豆</button> ');
    $("#btnCharge").click(function(){

    });
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


//检查关注效果：如果检查到有cookie，则弹出确认对话框，供确认
function resultCheck(){
    var accountInfo = $.cookie('sxAccount');
    console.log("load accountInfo from cookie.",accountInfo);
    if(accountInfo && accountInfo.trim().length>0){
        console.log("get accountInfo info from cookie.",accountInfo);
        var account = JSON.parse(accountInfo);
        $("#btnNo").click(function(){
            $.cookie('sxAccount', "", { path: '/' }); //清除cookie重新来过
            $.unblockUI(); 
        });
        $("#btnYes").click(function(){//完成关注确认
            console.log("try to submit subscribe event.");
            $.cookie('sxAccount', "", { path: '/' }); //清除cookie重新来过
            costPoints(account);            
        });
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
            subscriber.points+",'',now())",
        type:"post",
        //data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },         
        success:function(json){
            console.log("===subscribes inserted===\n",json);
            //从当前列表中删除该文章
            $("div[data='"+account.id+"']").remove();
        }
    });     
}


//显示发布公众号表单
function showAccountForm(){
    console.log("show account form.");
    //判断阅豆是否足够：
    if(broker&&broker.status=='disabled'){
        siiimpleToast.message('抱歉，你的账户出现异常，请与我们联系~~',{
              position: 'bottom|center'
            });
    }else if(broker&&broker.points<10){
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
                siiimpleToast.message('公众号名称不能为空，请重新输入~~',{
                  position: 'bottom|center'
                });                 
            }else{//先检查微信公众号图片
                isOriginalIdValid($("#accountOriginalId").val());
            }
            /**
            else if(!isOriginalIdValid($("#accountOriginalId").val())){
                $("#accountName").css("border","1px solid silver");
                $("#accountOriginalId").css("border","1px solid red");
                $("#accountOriginalId").val("");//清空原有数值，避免交叉
                $("#accountOriginalId").attr('placeholder',"进入要发布的公众号介绍界面，在【基础信息】中复制【微信号】，粘贴即可");
                siiimpleToast.message('公众号微信ID输入有误，请重新输入~~',{
                  position: 'bottom|center'
                }); 
            }else{
                $("#accountName").css("border","1px solid silver");
                $("#accountOriginalId").css("border","1px solid silver");
                console.log("try to submit subscribe event.");
                submitAccount();
            }
            //**/
        });       
        /**
        $("#btnPublish").click(function(){//发布公众号
            var valid = true;
            if(!$("#accountName").val() || $("#accountName").val().trim().length==0){
                $("#accountName").css("border","1px solid red");
                $("#accountName").val("");//清空原有数值，避免交叉
                valid = false;
            }
            if(!isOriginalIdValid($("#accountOriginalId").val())){
                $("#accountOriginalId").css("border","1px solid red");
                $("#accountOriginalId").val("");//清空原有数值，避免交叉
                valid = false;
            }
            if(valid){
                console.log("try to submit subscribe event.");
                submitAccount();
            }
        });
        //**/
    }
}


//判定公众号原始ID是否正确
function isOriginalIdValid(originalId) {
    //console.log("originalId",originalId);
    var pathImg = wxLogoPrefix + originalId;
    console.log("originalId",originalId, pathImg);

    var ImgObj = new Image();
    ImgObj.src= pathImg;
    ImgObj.onload = function(){
         console.log("got wx account logo image.",ImgObj.width,ImgObj.height);
         if(ImgObj.fileSize > 0 || (ImgObj.width > 0 && ImgObj.height > 0)){//图片存在则认为是正确的公众号ID
            $("#accountName").css("border","1px solid silver");
            $("#accountOriginalId").css("border","1px solid silver");
            console.log("try to submit subscribe event.");
            submitAccount();
         }else{//否则也提示错误
            $("#accountName").css("border","1px solid silver");
            $("#accountOriginalId").css("border","1px solid red");
            $("#accountOriginalId").val("");//清空原有数值，避免交叉
            $("#accountOriginalId").attr('placeholder',"进入要发布的公众号介绍界面，在【基础信息】中复制【微信号】，粘贴即可");
            siiimpleToast.message('公众号微信ID输入有误，请重新输入~~',{
              position: 'bottom|center'
            }); 
         }
    };
    ImgObj.onerror = function() {
        console.log("Image failed!",originalId, pathImg);
        $("#accountName").css("border","1px solid silver");
        $("#accountOriginalId").css("border","1px solid red");
        $("#accountOriginalId").val("");//清空原有数值，避免交叉
        $("#accountOriginalId").attr('placeholder',"进入要发布的公众号介绍界面，在【基础信息】中复制【微信号】，粘贴即可");
        siiimpleToast.message('公众号微信ID输入有误，请重新输入~~',{
          position: 'bottom|center'
        });         
    };    
}

//添加公众号：获取名称、描述、原始ID
function submitAccount(){
    var originalId = $("#accountOriginalId").val().trim();
    $("#accountOriginalId").css("border","1px solid silver");//恢复标准风格
    var name = $("#accountName").val().trim();
    $("#accountName").css("border","1px solid silver");//恢复标准风格
    var desc = $("#accountDesc").val().trim();
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
            qrcodeImg:"https://open.weixin.qq.com/qr/code?username="+originalId,
            originalId:originalId,
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

//手动置顶指定公众号：仅用于发布新公众号时
function toppingItem(item){
    if(!item || !item.id){
        console.log("wrong account");
        return;
    }
    //公众号logo
    logo = "https://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg";
    //直接根据originalId显示缩略图
    if(item.originalId){
        logo = "https://open.weixin.qq.com/qr/code?username="+item.originalId;
    }

    //新公众号默认显示到顶部：仅在发布者界面
    var tags = "<span style='margin-right:5px;padding:0 2px;border:1px solid red;color:red;border-radius:5px;font-size:12px;line-height:16px;'>新公众号首发</span>";
    var advertise = "";

    var title = "<div class='title'>"+tags+item.name+advertise+"</div>";
    var imageBg = "<div id='qrcodeimg"+item.id+"' class='qrcodeimg'></div>";
    var description = item.description&&item.description.trim().length>0?"<div class='description'>"+item.description+"</div>":"";
    var publishDate = "<div class='description'>"+item.updateDate+"</div>";

    var btns = "";
    //置顶：购买广告位
    btns += '<button type="submit" class="action-tag-orange" id="btnTopping'+item.id+'">置顶</button> ';   
    //顶一下：用阅豆临时置顶，时间10分钟
    btns += '<button type="submit" class="action-tag-orange" id="btnCall'+item.id+'">顶一下</button> ';       
    //上架、下架
    if(item.status=="active"){
        btns += '<button type="submit" class="action-tag-black" id="btnDeactive'+item.id+'">下架</button> ';
        btns += '<button type="submit" class="action-tag-orange" style="display:none" id="btnActive'+item.id+'">上架</button> ';
    }else{
        btns += '<button type="submit" class="action-tag-black" style="display:none" id="btnDeactive'+item.id+'">下架</button> ';
        btns += '<button type="submit" class="action-tag-orange" id="btnActive'+item.id+'">上架</button> ';
    }
    //置顶明细：弹出显示置顶明细列表，包括置顶及顶一下
    btns += '<button type="submit" class="action-tag-black" id="btnToppingHistory'+item.id+'">置顶明细</button> ';   
    //开白明细：弹出显示开白明细列表
    btns += '<button type="submit" class="action-tag-black" id="btnForwardList'+item.id+'">开白明细</button> ';      
    //关注明细：能够查看报数历史
    btns += '<button type="submit" class="action-tag-black" id="btnSubscribeHistory'+item.id+'">关注明细</button> ';     
    var btnsDiv = "<div class='btns' style='display:flex;flex-direction:row;flex-wrap:nowrap;margin-top:5px;'>"+btns+"</div>";    

    var seperator = "<div class='item-separator' style='border-radius:0'></div>";

    $("#createAccountEntry").after("<li><div class='task' data='"+item.id+"' data-title='"+item.name+"' data-url='"+item.url+"'><div class='task-logo'>" + imageBg +"</div><div class='task-tags'>" +title +description+publishDate+btnsDiv+"</div>"+seperator+"</li>");

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
            title:$(this).attr("data-title"),//标题
            url:$(this).attr("data-url"),//文章URL
            startTime: new Date().getTime()//开始时间戳：需要超过10秒
        };
               
        console.log("Publisher::Accounts save account to cookie.",pendingAccount);
        $.cookie('sxAccount', JSON.stringify(pendingAccount), { expires: expDate, path: '/' });  //把浏览中的id写入cookie便于记录阅读数       

        //显示二维码供扫描关注
        console.log("Publisher::Accounts now show QRcode.");
        $("#pendingAccountQrcode").append("<img src='"+$(this).attr("data-url")+"' width='200' height='200'/>");        

    });


    //注册事件
    $("#btnDeactive"+item.id).click(function(){ //下架      
        changeAccountStatus($(this).attr("id").replace(/btnDeactive/,""),"inactive");
    });
    $("#btnActive"+item.id).click(function(){ //上架   
        changeAccountStatus($(this).attr("id").replace(/btnActive/,""),"active");
    });       
    $("#btnTopping"+item.id).click(function(){ //无敌置顶：要花钱的那种 
        loadSoldAds($(this).attr("id").replace(/btnTopping/,""));//需要传递当前公众号ID
    }); 
    $("#btnPoorTopping"+item.id).click(function(){ //临时置顶：不花钱的那种 
        showPoorToppingForm($(this).attr("id").replace(/btnPoorTopping/,""));//需要传递当前公众号ID
    }); 
    $("#btnToppingHistory"+item.id).click(function(){ //显示当前公众号的置顶明细
        showUpcomingToppings($(this).attr("id").replace(/btnToppingHistory/,""));//需要传递当前公众号ID
    });     
    $("#btnSubscribeHistory"+item.id).click(function(){ //显示当前公众号的报数明细
        loadSubscribes($(this).attr("id").replace(/btnSubscribeHistory/,""));//需要传递当前公众号ID
    });     
    $("#btnForwardList"+item.id).click(function(){ //显示开白请求明细 
        loadForwards($(this).attr("id").replace(/btnForwardList/,""));//需要传递当前公众号ID
    });      
}

//查询阅我总数：排除自己的阅读
var totalSubscribeme = 0;
function countSubscribemeTotal(){
    $.ajax({
        url:app.config.analyze_api+"?query=select count(eventId) as totalCount from ilife.subscribes where publisherOpenid='"+userInfo._key+"' and subscriberOpenid!='"+userInfo._key+"' format JSON",
        type:"get",
        //async:false,
        //data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },         
        success:function(res){
            console.log("Publisher::My::countSubscribemeTotal try to retrive subscribeme count.", res)
            if(res && res.rows==0){//无法回直接忽略
                //do nothing
            }else{//如果大于0则更新到页面
                //if(res.data[0].totalCount>0){
                    var oldTxt = $("#myAccountFilter").text();
                    totalSubscribeme = res.data[0].totalCount;
                    if(totalAccounts>1){
                        $("#myAccountFilter").text("公众号("+totalSubscribeme+"/"+totalAccounts+")");  
                    }else if(totalAccounts>0){
                        $("#myAccountFilter").text("公众号("+totalSubscribeme+")");  
                    }   
                //}
            }
        }
    }); 
}

//查询公众号总数
var totalAccounts = 0;
function countAccountTotal(){
    $.ajax({
        url:app.config.sx_api+"/wx/wxAccount/rest/total-accounts/"+userInfo._key,
        type:"get",        
        success:function(res){
            console.log("got account count.",res);
            if(res.status && res.count){//显示到界面
                var oldTxt = $("#myAccountFilter").text(); 
                totalAccounts = res.count;
                if(totalAccounts>1){
                    $("#myAccountFilter").text("公众号("+totalSubscribeme+"/"+totalAccounts+")");  
                }else if(totalAccounts>0){
                    $("#myAccountFilter").text("公众号("+totalSubscribeme+")");  
                }           
            }      
        }
    }) 
}

//加载显示广告位：查询可用广告位后按照日期、时间段展示
var selectedAds = {};//记录选中的广告价格明细：key为广告位分组，组织形式：日期__广告位ID；价格为单一数值
//var selectedAdNames = {};//记录选中的广告位明细：key为广告位分组，组织形式：日期__广告位ID；名称为：日期-时间-广告位
var allAds = [];//所有可用广告位列表。提前加载后缓存，显示时需要根据购买情况过滤。是json对象数组
var soldAds = [];//已售卖广告位列表。在显示前直接查询得到。是单值组织的广告位，组织形式：日期__广告位ID
function loadAds(){
    //查询得到公众号置顶广告位
    $.ajax({
        url:app.config.sx_api+"/wx/wxAdvertise/rest/ads/account",
        type:"get",        
        success:function(res){
            console.log("got available account ads.",res);
            allAds = res;
            //注意：此处仅提前加载所有广告位清单。用户点击后才查询已售广告位，并显示到界面
            //showAds(res); //根据返回的广告位列表展示：包括3个连续日期。TODO：由于需要检查购买情况，在触发置顶操作后再显示
        }
    }) 
}

//加载已购买广告位：需要一次性查询连续3天的已购买情况
//直接返回所有已购买列表：需要组装为可检索模式
var tmpAdQuantity = {};//记录可重复售卖广告的quantity，key为 展示日期+广告位ID，形式为2022-04-01xxxxxx，value为 quantity
var tmpAdSoldCount = {};//记录可重复售卖广告的实际售卖数量，key为 展示日期+广告位ID，形式为2022-04-01xxxxxx，，value为 sold。该值需要统计得到
var toppingAccountId = null;//记录当前待置顶公众号ID
function loadSoldAds(accountId){
    console.log("try to check ads for account.",accountId);
    toppingAccountId = accountId;
    //查询得到临近3天的已售卖广告位
    $.ajax({
        url:app.config.sx_api+"/wx/wxPaymentAd/rest/sold-in-advance/3",//需要取几天可直接传递
        //async:false,//注意是同步调用
        type:"get",        
        success:function(res){
            console.log("got sold ads.",res);
            //需要过滤。根据quantity进行。对于quantity为1的，直接组装广告位加入soldAds列表，对于quantity>1的情况，需要通过缓存计算后判定
            res.forEach(function(json){
                var adId = json.advertiseDate+json.advertise.id; //将展示日期及广告位ID组合作为唯一识别码，形式：2020-04-01xxxxxx
                if(json.advertise.quantity==1){//仅有一个广告位的情况，直接加入已售完列表
                    soldAds.push(adId);
                }else if(json.advertise.quantity>1){//加入临时存储，需要进行统计计算
                    tmpAdQuantity[adId]=json.advertise.quantity;//记录广告位可卖数量
                    //累计该广告位的实际售卖数量
                    if(!tmpAdSoldCount[adId]){
                        tmpAdSoldCount[adId] = 1;
                    }else{
                        tmpAdSoldCount[adId] = tmpAdSoldCount[adId] + 1;
                    }
                    console.log("tmpAdSoldCount",tmpAdSoldCount);
                    //判断是否已经达到可售数量
                    if(tmpAdSoldCount[adId]>=json.advertise.quantity){//加入已售完列表
                        soldAds.push(adId);
                    }
                }else{//其他直接忽略
                    //数量小于1？
                }
            });
            //显示广告到界面
            showAds(accountId);
        }
    }) 
}

//将广告显示到界面，供选择
//遍历availableAds，逐条显示：先根据时间段判断对应时段div是否已存在，否的话直接添加，然后在时间段下添加广告位
//对于当前日期：当前时间以前的均不显示，仅显示当前时间以后的。区分可买与已售
//对于其他日期：显示所有条目，区分可买与已售
//点选事件：点选后需要更新广告位记录，包括日期、广告位ID、价格；及名称。点选后需要汇总所有已选中广告价格
function showAds(){
    //得到连续3天的时间
    var preSaleDates = [];
    var currentTimestamp = new Date().getTime();//获取毫秒时间
    preSaleDates.push(new Date(currentTimestamp));//今天
    preSaleDates.push(new Date(currentTimestamp+24*60*60*1000));//明天
    preSaleDates.push(new Date(currentTimestamp+2*24*60*60*1000));//后天

    //将日期映射到：今天、明天、后天，与展示元素标签对应
    var dateMapping = {};
    dateMapping[DateFormatter.format('%m-%d', new Date(currentTimestamp))] = "today";
    dateMapping[DateFormatter.format('%m-%d', new Date(currentTimestamp+24*60*60*1000))] = "tomorrow";
    dateMapping[DateFormatter.format('%m-%d', new Date(currentTimestamp+2*24*60*60*1000))] = "aftertomorror";

    //根据广告位逐条、逐天显示
    allAds.forEach(function(item){
        //console.log("try show ad.",item);
        //逐天显示
        preSaleDates.forEach(function(dateEntry){
            //根据指定日期，以及广告时间段组装开始时间
            //开始时间
            var advertiseDate = dateEntry;
            var advertiseTime = item.timeSlotFrom.split(":");//显示形式为00:00:00，取前两段即可
            advertiseDate.setHours(Number(advertiseTime[0]));
            advertiseDate.setMinutes(Number(advertiseTime[1]));
            advertiseDate.setSeconds(Number(advertiseTime[2]));
            //结束时间
            //var advertiseDate2 = dateEntry;//如果多个对象引用dateEntry，数据会被覆盖，需要重新构建对象
            var advertiseDate2 = new Date();
            advertiseDate2.setFullYear(dateEntry.getFullYear());
            advertiseDate2.setMonth(dateEntry.getMonth());
            advertiseDate2.setDate(dateEntry.getDate());
            var advertiseTime2 = item.timeSlotTo.split(":");//显示形式为00:00:00，取前两段即可
            advertiseDate2.setHours(Number(advertiseTime2[0]));
            advertiseDate2.setMinutes(Number(advertiseTime2[1]));
            advertiseDate2.setSeconds(Number(advertiseTime2[2]));        
            //判断是否是未来时间：另一种方案:根据advertiseDate2进行判断，能够支持立即购买    
            if(advertiseDate2.getTime()>new Date().getTime()){//仅对未来时间展示
                //检查所在分组的时间段是否已显示
                var advertiseTimeSlotKey = DateFormatter.format('%m-%d-%H-%i-%s', advertiseDate);
                //console.log("advertiseDate",advertiseDate,item.timeSlotFrom);
                //console.log("advertiseDate2",advertiseDate2,item.timeSlotTo);
                var advertiseTimeSlotName = DateFormatter.format('%m-%d %H:%i', advertiseDate)+"至"+DateFormatter.format('%H:%i', advertiseDate2);//显示为：02-03 07:00至08:00
                if ($('#slotWrapper'+advertiseTimeSlotKey).length <= 0) { //如果不存在则创建
                    var advertiseTimeSlotHtml = "<div id='slotWrapper"+advertiseTimeSlotKey+"'><div class='adslot-name' id='slotName"+advertiseTimeSlotKey+"'>"+advertiseTimeSlotName+"</div><div class='adslot-grid' id='slot"+advertiseTimeSlotKey+"'></div></div>";
                    $("#tabs-"+dateMapping[DateFormatter.format('%m-%d', advertiseDate)]).append(advertiseTimeSlotHtml);
                }
                //显示可用广告位：显示为radio，id为slotkey+广告位id，group为slotkey
                var advertiseSpotKey = advertiseTimeSlotKey+item.id;
                var spotTips = "￥"+item.price/100;
                var disabled = "";
                var spotStyle = "";
                //判断是否已售
                if(soldAds.indexOf(DateFormatter.format('%Y-%m-%d', advertiseDate)+item.id)>=0){//形式为 2020-04-01xxxxx
                    spotTips = "已抢";
                    if(item.quantity>1){//如果是多坑位
                        spotTips = "满坑";
                    }
                    disabled = "disabled";
                    spotStyle="adspot-disabled"
                }
                var advertiseSpotHtml = "";
                advertiseSpotHtml += '<div class="adspot-block '+spotStyle+'">';
                advertiseSpotHtml += '<input type="radio" class="adspot-input" id="'+advertiseSpotKey+'" data-adid="'+item.id+'" data-addate="'+DateFormatter.format('%Y-%m-%d', advertiseDate)+'" name="'+advertiseTimeSlotKey+'" value="'+item.price+'" '+disabled+'>';
                advertiseSpotHtml += '<label  class="adspot-label" for="'+advertiseSpotKey+'">'+item.name+" "+spotTips+'</label>';
                advertiseSpotHtml += '</div>';
                $("#slot"+advertiseTimeSlotKey).append(advertiseSpotHtml);
                
                //注册点击事件
                $("#"+advertiseSpotKey).click(function(){
                    console.log("choose advertise spot",$(this).attr("id"),$(this).val());
                    //更新到已选广告列表内：注意要根据广告时段存储，一个时段只能有一个
                    selectedAds[$(this).attr("name")]={
                        date:$(this).attr("data-addate"),//展示日期：2022-04-01
                        id:$(this).attr("data-adid"),//广告位ID
                        price:Number($(this).val())
                    };
                    //计算广告金额汇总
                    var totalAmount = 0;
                    for (var key in selectedAds){
                        totalAmount += selectedAds[key].price;//单位为分，是整数，直接相加
                        //处理四舍五入
                        //totalAmount = Math.floor(totalAmount * 100) / 100;
                    }   
                    //更新到底部汇总区域
                    console.log("total amount calculated.",totalAmount);
                    $("#totalAmountTips").text("总计："+totalAmount/100);
                    $("#totalAmount").val(totalAmount);
                });
            }else{//直接忽略
                console.log("passed time. ignore.",advertiseDate);
            }
        });
    });

    //显示tabs
    $( "#adTabs" ).tabs();

    //显示广告购买表单
    $.blockUI({ message: $('#adPurchaseForm'),
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
}

//清空广告及显示：在点击取消或购买完成后均需清空
function clearAds(){
    selectedAds = {};//清空已选广告列表
    soldAds = [];//清空已售广告列表     
    tmpAdQuantity = {};//清空一位多卖记录
    tmpAdSoldCount = {};//清空一位多卖实际出售记录
    toppingAccountId = null;//清空当前公众号ID
    $("#tabs-today").empty();
    $("#tabs-tomorrow").empty();
    $("#tabs-aftertomorror").empty();    
}

//下单：通过后台生成支付预订单，在获取prepay_id后调用js支付
var out_trade_no = null;
function createPayInfo(){
    out_trade_no = "pac"+hex_md5(userInfo._key+"account"+toppingAccountId+(new Date().getTime())).substr(3);//表示购买阅豆: 总长度32位， 前三位pac为公众号置顶，par为文章置顶，ppt为购买阅豆
    $.ajax({
        url:app.config.sx_api+"/wxPay/rest/payinfo",
        type:"post", 
        data:JSON.stringify({
            openid:userInfo._key,
            out_trade_no:out_trade_no,
            total_fee:Number($("#totalAmount").val()),//*100,//单位为分
            body:"内容展示及排序服务",
            trade_type:"JSAPI",
            spbill_create_ip:""//returnCitySN.cip//查询得到本机ip地址

        }),    
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },             
        success:function(res){
            console.log("got wechat payinfo.",res);
            if(res.success){
                console.log("try to start wechat pay.",res);
                payOrder(res.data);
            }
        }
    }) 
}

//支付：发起微信支付提交购买。支付成功后创建购买记录
function payOrder(payInfo){
    console.log("start wx pay",payInfo);
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
                  'chooseWXPay',                
                ] // 必填，需要使用的JS接口列表
            });
            wx.ready(function() {
                // config信息验证后会执行ready方法，所有接口调用都必须在config接口获得结果之后，config是一个客户端的异步操作，所以如果需要在页面加载时就调用相关接口，
                // 则须把相关接口放在ready函数中调用来确保正确执行。对于用户触发时才调用的接口，则可以直接调用，不需要放在ready函数中。
                console.log("before wx.chooseWXPay. payInfo.",payInfo);
                wx.chooseWXPay({
                  timestamp: payInfo.timeStamp, // 支付签名时间戳，注意微信jssdk中的所有使用timestamp字段均为小写。但最新版的支付后台生成签名使用的timeStamp字段名需大写其中的S字符
                  nonceStr: payInfo.nonceStr, // 支付签名随机串，不长于 32 位
                  package: payInfo.package, // 统一支付接口返回的prepay_id参数值，提交格式如：prepay_id=\*\*\*）
                  signType: 'MD5', // 微信支付V3的传入RSA,微信支付V2的传入格式与V2统一下单的签名格式保持一致
                  paySign: payInfo.paySign, // 支付签名
                  success: function (res) {
                    // 支付成功后的回调函数
                    console.log("wechat pay finished.",res);    
                    if(res.errMsg == "chooseWXPay:ok"){//注意：支付完成后仅返回状态，无transaction_id、out_trade_no等。需要手动补全，并由后台更新订单状态
                        purchaseAd(res);
                    }else{
                        siiimpleToast.message('未能成功支付，请重新尝试。',{
                          position: 'bottom|center',
                          delay: 1000
                        });
                    }          
                  },
                  cancel: function (err) {
                    // 用户取消支付
                    console.log("cancel pay",err);
                    siiimpleToast.message('支付已取消，请重新尝试。',{
                      position: 'bottom|center',
                      delay: 1000
                    });
                  },
                  fail: function (res) {
                    // 支付失败
                    console.log("pay fail.",res);
                    siiimpleToast.message('支付失败，请重新尝试。',{
                      position: 'bottom|center',
                      delay: 1000
                    });            
                  }
                });          
            });
            wx.error(function(res){
              // config信息验证失败会执行error函数，如签名过期导致验证失败，具体错误信息可以打开config的debug模式查看，也可以在返回的res参数中查看，对于SPA可以在这里更新签名。
              console.log("wx.error ",res);
            });
        }
    })  
}

//创建已购买的广告位：仅在支付成功后提交。其他不做考虑：如果支付取消，或中途退出？？
//提交数据包括：达人ID或达人openid，公众号ID，已选广告列表。支付结果数据
function purchaseAd(wxPayResult){
    //将selectedAds转化为数组
    var purchasedAds = [];
    for (var key in selectedAds){
        purchasedAds.push(selectedAds[key]);
    }
    //提交购买记录
    $.ajax({
        url:app.config.sx_api+"/wx/wxPaymentAd/rest/purchase",
        type:"post", 
        data:JSON.stringify({
            brokerId:(broker&&broker.id)?broker.id:"",
            brokerOpenid:userInfo._key,
            subjectType:"account",
            subjectId:toppingAccountId,
            ads:purchasedAds,
            out_trade_no:out_trade_no,//直接用前台组织的out_trade_no
            result_code:wxPayResult.errMsg //errMsg即为状态码
        }),    
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },             
        success:function(res){
            console.log("ad purchased.",res);
            clearAds();
            $.unblockUI(); 
            if(res.success){//不处理重复购买的情况
                siiimpleToast.message('恭喜，购买成功，置顶已安排~~',{
                      position: 'bottom|center'
                    });                
            }
        }
    });
}

//显示临时置顶表单。能够选择置顶方案：根据阅豆消耗
function showPoorToppingForm(accountId){
    toppingAccountId = accountId;
    //根据阅读显示方案。阅豆不足的显示灰色：10阅豆、20阅豆
    var products={//key值为指定阅豆数，同时也是置顶分钟数
        "10":"置顶10分钟",
        "20":"置顶20分钟",
        "30":"置顶30分钟",
        "60":"置顶1小时"
    };
    //显示置顶选项
    for (var key in products){
        var enabled = "poor-topping-enabled";
        var priceTip = "";
        if(broker&&broker.points<Number(key)){
            enabled = "poor-topping-disabled";
            priceTip = "(阅豆不足)";
        }
        var html = "<div class='poor-topping-block "+enabled+"' id='poorTopping"+key+"' data-duration='"+key+"' data-points='"+key+"'>"
        +"<div class='poor-topping-name'>"+products[key]+"</div>"
        +"<div class='poor-topping-price'>消耗 "+key+" 阅豆"+priceTip+"</div>"
        +"</div>";
        $("#poorToppingDiv").append(html);
        //注册点击事件：仅在点数支持时才能点击
        if(broker&&broker.points>=Number(key)){
            $("#poorTopping"+key).click(function(){
                insertPoorTopping(accountId,Number($(this).attr("data-points")),Number($(this).attr("data-duration")));
            });
        }
    }    

    //显示临时置顶表单
    $.blockUI({ message: $('#poorToppingForm'),
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
}

//新增临时置顶。需要选择置顶方案，提供10豆、20豆、30豆、60豆等
function insertPoorTopping(accountId,points,duration){
    $.ajax({
        url:app.config.sx_api+"/wx/wxTopping/rest/poor-topping/account",
        type:"post", 
        data:JSON.stringify({
            brokerId:(broker&&broker.id)?broker.id:"",
            brokerOpenid:userInfo._key,
            points:points,//阅豆数
            advertiseDate:new Date(),//即时生效
            advertiseDuration:duration*60*1000,//毫秒数
            subjectType:"account",
            subjectId:accountId
        }),    
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },             
        success:function(res){
            console.log("poor topping inserted.",res);
            $.unblockUI(); //解除锁屏
            $("#poorToppingDiv").empty();//清空原有内容
            //扣除阅豆，并更新当前阅豆数
            if(broker&&broker.points&&res.points){
                broker.points = broker.points-res.points;
                insertBroker(broker);
            }
            //提示信息
            siiimpleToast.message('恭喜，置顶已安排~~',{
                  position: 'bottom|center'
                });             
        }
    });    
}

//显示尚未开始的置顶明细，包括当前正在置顶的条目
function showUpcomingToppings(accountId){
    toppingAccountId = accountId;
    var data = {//以下均为必须参数，可以置空
            brokerId:(broker&&broker.id)?broker.id:"",
            brokerOpenid:userInfo._key,
            advertiseType:"",//不限制广告类型
            subjectType:"account",
            subjectId:accountId
        };
    console.log("try query upcoming list.",data);
    //查询并显示即将到来的置顶
    $.ajax({
        url:app.config.sx_api+"/wx/wxTopping/rest/upcoming",
        type:"get", 
        data:data,    
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },             
        success:function(list){
            console.log("got upcoming topping records.",list);
            if(list.length>0){
                $("#upcomingToppingDiv").empty();
            }
            //逐条显示
            list.forEach(function(item){
                //日期、开始时间、截止时间、置顶类型 DateFormatter.format('%m-%d-%H-%i-%s', advertiseDate)
                var html = "";
                html += "<div class='upcoming-item'>";
                html += "<div class='upcoming-date'>"+item.advertiseDate.split(" ")[0]+"</div>";
                html += "<div class='upcoming-time'>"+item.advertiseTimeFrom.split(" ")[1].substr(0,5)+" 至 "+item.advertiseTimeTo.split(" ")[1].substr(0,5)+"</div>";
                html += "<div class='upcoming-advertise'>"+(item.advertise?item.advertise.name:"排队坑位")+"</div>";
                html += "<div class='upcoming-type'>"+(item.advertiseType=="money"?"无敌置顶":"顶一下")+"</div>";
                html += "</div>";
                $("#upcomingToppingDiv").append(html);
            });
            //显示置顶明细表单
            $.blockUI({ message: $('#upcomingToppingForm'),
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
        }
    });
}


//加载阅读该公众号的日志记录：限制1000条
function loadSubscribes(accountId){
    toppingAccountId = accountId;
    //查询阅读当前用户公众号的事件列表
    var q = "select eventId,subscriberOpenid as openid,subscriberNickname as nickname,subscriberAvatarUrl as avatarUrl,accountName,ts from ilife.subscribes where accountId='"+accountId+"' and subscriberOpenid!='"+userInfo._key+"' order by ts desc limit 1000 format JSON";
    $.ajax({
        url:app.config.analyze_api+"?query="+q,
        type:"get",
        //data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },         
        success:function(res){
            console.log("got read events.", res)
            if(res && res.rows==0){//如果没有则提示还没有阅读
                $("#subscribesDiv").html('<div style="line-height: 30px;font-size: 12px;">没有关注记录哦，尝试获得更多阅豆或置顶吧~~</div>');
            }else{//否则显示到页面：简单列表展示
                $("#subscribesDiv").empty();
                res.data.forEach(function(item){
                    var html = "";
                    html += "<div class='reads-item'>";
                    html += "<div class='reads-date'>"+item.ts+"</div>";
                    html += "<div class='reads-subscribername' style='width:60%'>"+item.nickname+"</div>";
                    //html += "<div class='reads-count'>"+item.readCount+"</div>";
                    html += "</div>";
                    $("#subscribesDiv").append(html);
                });
            }
            //显示置顶明细表单
            $.blockUI({ message: $('#subscribesForm'),
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
        }
    }); 
}


//加载开白明细：加载全部。默认数据不会超过100条
function loadForwards(accountId){
    //查询阅读当前用户文章的事件列表
    $.ajax({
        url:app.config.sx_api+"/wx/wxForward/rest/requests/account/"+accountId,
        type:"get",
        //data:{},         
        success:function(res){
            console.log("got forward events.", res)
            if(res && res.length==0){//如果没有则提示还没有
                $("#forwardsDiv").html('<div style="line-height: 30px;font-size: 12px;">还没有开白请求哦~~</div>');
            }else{//否则显示到页面：简单列表展示
                $("#forwardsDiv").empty();
                res.forEach(function(item){
                    var statusStr = "待回应";
                    if(item.status=="rejected"){
                       statusStr = "已拒绝"; 
                    }else if(item.status=="approved"){
                       statusStr = "已开白"; 
                    }else{//显示前往处理
                        statusStr = "<a href='forward.html?id="+item.id+"'>待回应</a>";
                    }
                    var html = "";
                    html += "<div class='reads-item'>";
                    html += "<div class='reads-date'>"+item.createDate+"</div>";
                    html += "<div class='reads-readername'>"+item.requestAccount.name+"</div>";
                    html += "<div class='reads-count'>"+statusStr+"</div>";
                    html += "</div>";
                    $("#forwardsDiv").append(html);
                });
            }
            //显示置顶明细表单
            $.blockUI({ message: $('#forwardsForm'),
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
        }
    }); 
 
}



