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
    var id = args["id"];//当前内容

    fromUser = args["fromUser"]?args["fromUser"]:"";//从连接中获取分享用户ID
    fromBroker = args["fromBroker"]?args["fromBroker"]:"";//从连接中获取分享达人ID。重要：将依据此进行收益计算

    //判断屏幕大小，如果是大屏则跳转
    /**
    if(width>=800){
        window.location.href=window.location.href.replace(/info2.html/g,"info.html");
    }
    //**/

    //判断是否为已注册用户
    if(app.globalData.userInfo&&app.globalData.userInfo._key){//表示是已注册用户
        loadBrokerByOpenid(app.globalData.userInfo._key);//如果已注册则检查是否是broker
    }

    //加载导航和内容
    loadCategories(category);
    loadItem(id);   
    loadHosts(id);
    registerShareHandler();//注意：存在二次注册，在加载完成达人信息后会重新注册
});

util.getUserInfo();//从本地加载cookie

//当前浏览内容
var stuff=null;

var galleryWidth = 672;
var galleryHeight = 378;

//记录分享用户、分享达人
var fromUser = "";
var fromBroker = "";
var broker = {};//当前达人

//将item显示到页面
function showContent(item){
    //购买按钮
    /*
    if(item.distributor && item.distributor.images && item.distributor.images.length>0)$("#shopping-summary").append("<img src='"+item.distributor.images[0]+"'/>");
    if(item.seller && item.seller.images && item.seller.images.length>0)$("#shopping-summary").append("<img src='"+item.seller.images[0]+"'/>");
    if(item.producer && item.producer.images && item.producer.images.length>0)$("#shopping-summary").append("<img src='"+item.producer.images[0]+"'/>");
    //*/
    $("#jumplink").click(function(){jump(item);}); 
    $("#jumpbtn").click(function(){jump(item);});   
    $("#title").click(function(){jump(item);}); 

    //标题与摘要
    $("#content").append("<div id='jumplink' class='title'>"+item.title+"</div>");//标题
    if(item.summary && item.summary.length>0)$("#content").append("<div class='summary'>"+item.summary+"</div>");//摘要
    for(var i=0;i<item.images.length;i++){//正文及图片
        $("#gallery").append("<li><img src='" + item.images[i] + "' alt=''/></li>");//加载图片幻灯
        $("#content").append("<img src='" + item.images[i] + "' width='100%'/>");//正文图片
    }

    //初始化图片幻灯
    $('#gallery').galleryView({
        panel_width: galleryWidth,
        panel_height: galleryHeight,
        frame_width: 80,
        frame_height: 60
    }); 

    //标题
    $("#title").html(item.title);
    
    //评分
    if(item.rank.score){
        $("#score .comment").append("<div class='label'>评价</div><div class='rank'>"+item.rank.score+"/<span class='base'>"+item.rank.base+"</span></div>");
    }else{
        $("#score .comment").append("<div class='label'>评价</div><div class='rank'><span class='empty'>暂无评分</span></div>");
    }    
    //$("#score .comment").append("<div class='label'>评价</div><div class='rank'>"+item.score.rank+"/<span class='base'>"+item.score.base+"</span></div>");
    $("#score .price").append("<div class='label'>价格</div><div class='price-sale'><span class='price-bid'>"+(item.price.bid?item.price.bid:"")+"</span>"+item.price.sale+"</div>");
    $("#score .score").append("<div class='label'>推荐度</div><div class='match'>"+(item.rank.match*100)+"%</div>");

    //二维码：使用海报图，将其中二维码进行裁剪
    if(item.link.qrcode){
        $("#qrcodeImg").attr("src",item.link.qrcode);
        $('#qrcodeImg').addClass('qrcode-'+item.source);//应用对应不同source的二维码裁剪属性
        $('#qrcodeImgDiv').addClass('qrcode-'+item.source+'-div');//应用对应不同source的二维码裁剪属性
        $("#qrcodeImgDiv").css('visibility', 'visible');
        $("#jumpbtn").text('扫码购买');
    }

    //标签
    if(item.distributor && item.distributor.name){//来源作为标签
        $("#tags").append("<div class='tag'>"+item.distributor.name+"</div>");
    }    
    for(var i=0;i<item.tags.length;i++){//标签云
        $("#tags").append("<div class='tag'>" + item.tags[i] + "</div>");//加载图片幻灯
    }
    //随机着色
    /*
    $("#tags").find("div").each(function(){
        var rgb = Math.floor(Math.random()*(2<<23));
        var bgColor = '#'+rgb.toString(16);
        var color= '#'+(0xFFFFFF-rgb).toString(16);
        $(this).css({"background-color":bgColor,"color":color});
    });
    //*/
    //广告
    //trace user action
    logstash(item,"mp","view",fromUser,fromBroker,function(){
        //do nothing
    });      
}

//佣金
function htmlItemProfitTags(item){
    var profitTags = "";
    //if(util.hasBrokerInfo()){//如果是推广达人则显示佣金
    if(item.profit&&item.profit.order){
        profitTags += "<span class='profitTipOrder'>店返</span><span class='itemTagProfitOrder' href='#'>¥"+(parseFloat((Math.floor(item.profit.order*10)/10).toFixed(1)))+"</span>";
        if(item.profit&&item.profit.team&&item.profit.team>0.1)profitTags += "<span class='profitTipTeam'>团返</span><span class='itemTagProfitTeam' href='#'>¥"+(parseFloat((Math.floor(item.profit.team*10)/10).toFixed(1)))+"</span>";
    }else if(item.profit&&item.profit.credit&&item.profit.credit>0){
        profitTags += "<span class='profitTipCredit'>积分</span><span class='itemTagProfitCredit' href='#'>"+(parseFloat((Math.floor(item.profit.credit*10)/10).toFixed(0)))+"</span>";
    }
    //}
    if(profitTags.trim().length>0){//如果已经存在则直接加载
        profitTags = "<div id='profit"+item._key+"' class='itemTags profit-show'>"+profitTags+"</div>";
    }else{//否则请求得到该item的profit信息
        profitTags = "<div id='profit"+item._key+"' class='itemTags profit-hide'></div>";
        getItemProfit(item);
    }  
    return profitTags;
}

//查询特定条目的佣金信息。返回order/team/credit三个值
function getItemProfit(item) {
    var data={
        source:item.source,
        price:item.price.sale,
        category:item.categoryId?item.categoryId:""
    };
    console.log("try to query item profit",data);
    util.AJAX(app.config.sx_api+"/mod/commissionScheme/rest/profit", function (res) {
        console.log("got profit info.",item,res);
        var showProfit = false;
        var html = "";
        if (res.order) {//店返
            html += "<span class='profitTipOrder'>店返</span><span class='itemTagProfitOrder' href='#'>¥"+(parseFloat((Math.floor(res.order*10)/10).toFixed(1)))+"</span>";
            if(res.team && res.team>0.1){//过小的团返不显示
                html += "<span class='profitTipTeam'>团返</span><span class='itemTagProfitTeam' href='#'>¥"+(parseFloat((Math.floor(res.team*10)/10).toFixed(1)))+"</span>";
            }
        }else if(res.credit&&res.credit>0){//如果没有现金则显示积分
            html += "<span class='profitTipCredit'>积分</span><span class='itemTagProfitCredit' href='#'>"+(parseFloat((Math.floor(res.credit*10)/10).toFixed(0)))+"</span>";
        }else{//这里应该是出了问题，既没有现金也没有积分
            console.log("===error===\nnothing to show.",item,res);
        }
        //显示到界面
        if(html.trim().length>0){
            $("#profit"+item._key).html(html);
            $("#profit"+item._key).toggleClass("profit-hide",false);
            $("#profit"+item._key).toggleClass("profit-show",true);
        }
        //TODO：更新到item       
    },"GET",data);
}

//根据openid查询加载broker
function loadBrokerByOpenid(openid) {
    console.log("try to load broker info by openid.[openid]",openid);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokerByOpenid/"+openid, function (res) {
        console.log("load broker info.",openid,res);
        if (res.status) {//将佣金信息显示到页面
            broker = res.data;
            //达人佣金
            var profitHtml = htmlItemProfitTags(stuff);
            if(profitHtml.trim().length>0){
                $("#profit").html(profitHtml);
                $("#profit").toggleClass("profit-hide",false);
                $("#profit").toggleClass("profit-show",true);
            }
        }
        //加载达人后再注册分享事件：此处是二次注册，避免达人信息丢失。
        registerShareHandler();
    });
}

//点击跳转到原始链接
function jump(item){//支持点击事件
    //console.log(item.id,item.url);
    //确定购买归属达人：如果本身是达人则记到自身，如果有fromBroker则记为fromBroker，都没有则记为system
    var benificiaryBrokerId = "system";//默认为平台直接分享
    if(broker&&broker.id){//如果当前分享用户本身是达人，则直接引用其自身ID
        benificiaryBrokerId=broker.id;
    }else if(fromBroker && fromBroker.trim().length>0){
        benificiaryBrokerId=fromBroker;
    }
    logstash(item,"mp","buy",fromUser,benificiaryBrokerId,function(){
        var target = item.url;
        if(item.link.qrcode){
            //it is a QRCODE
            $("#jumpbtn").text("扫码购买哦");
        }else if(item.link.cps && item.link.cps[benificiaryBrokerId]){//能够直接获得达人链接则直接显示
            window.location.href = item.link.cps[benificiaryBrokerId];
        }else{//否则请求其链接并显示
            getBrokerCpsLink(benificiaryBrokerId,item);
        }
    });     
}

 //根据Broker查询得到CPS链接
 //注意：由于目标达人的推广位可能尚未建立，导致内容展示和购买记录中有收益记录，但实际CPS链接为system的情况。结算时会有差异。
 //解决办法：对于不同级别达人，需要告知此种情况，对于需要额外建立推广位的可能存在误差
function getBrokerCpsLink(brokerId,item) {
    var data={
        brokerId:brokerId,
        source:item.source,
        category:"",//注意：不按照类别进行区分
        //category:item.categoryId?item.categoryId:"",
        url:item.link.wap
    };
    console.log("try to generate broker specified url",data);
    util.AJAX(app.config.sx_api+"/mod/cpsLinkScheme/rest/cpslink", function (res) {
        console.log("======\nload cps link info.",data,res);
        if (res.status) {//将跳转到该链接
            window.location.href = res.link;
            //TODO：更新到item
        }else{//如果不能生成链接则直接使用已有链接
            if(item.link.wap2){
                window.location.href = item.link.wap2;
            }else if(item.link.wap){
                window.location.href = item.link.wap;
            }else{
                //there is no url link to jump
                //it is a QRCODE
                $("#jumpbtn").text("啊哦，这货买不了");
            }
        }
    },"GET",data);
}

/*
<view class="person" data-url="{{_key}}" catchtap='jump'>
    <image class="person-img" mode="aspectFill" src="{{avatarUrl}}" data-url="{{_key}}" catchtap='jump'/>
    <view class="person-name">{{nickName}}</view>
    <!-- 关注按钮 -->
    <view class="connect-status{{connected?'':'-pending'}}">{{connected?'已关注':'+关注'}}</view> 
</view>  
*/
function showHosts(hosts){
    //单行显示
    var templateFlat="<div id='__key' class='person'>"+
    "<div class='logo'><img src='__imgSrc' alt='__name'/></div>"+//image
    "<div class='name'>__name</div>"+//name
    //"<div class='connection'><button type='button' class='btn __status'>__text</button></div>"+//button
    "</div>";
    //折叠显示
    var templateFold="<div id='__key' class='swiper-slide person-fold'>"+
    "<div class='logo'><img src='__imgSrc' alt='__name'/></div>"+//image
    "<div class='name'>__name</div>"+//name
    //"<div class='connection'><button type='button' class='btn __status'>__text</button></div>"+//button
    "</div>";
    //判断是否折叠显示
    var isFold = hosts.length>3?true:false;
    var authorEl = isFold?$("#persons"):$("#author")
    var template = isFold?templateFold:templateFlat;
    for(var i=0;i<hosts.length;i++){
        var h = hosts[i];
        var hostEl = template.replace(/__imgSrc/g,h.avatarUrl)
            .replace(/__key/g,h._key)
            .replace(/__name/g,h.nickName)
            .replace(/__status/g,"toconnect")
            .replace(/__text/g,"+关注");
        authorEl.append(hostEl);

        //注册点击事件，通过jQuery事件监听
        $("#"+h._key).click(function(e){
            console.log("try to view person by jQuery click event.",h._key,e.currentTarget.id,e);
            window.location.href="user.html?id="+e.currentTarget.id;
        });        
    }
    if(isFold){//仅显示折叠父元素
        $("#author").css("display","none");
        $("#author-fold").css("display","flex");
          //显示滑动条
          var mySwiper = new Swiper ('.swiper-container', {
              slidesPerView: 8,
          });          
    }else{
        $("#author").css("display","block");
        $("#author-fold").css("display","none");
    }
}

function loadItem(key){//获取内容列表
    $.ajax({
        url:"https://data.shouxinjk.net/_db/sea/my/stuff/"+key,
        type:"get",
        data:{},
        success:function(data){
            showContent(data);
            stuff = data;//本地保存，用于分享等后续操作
        }
    })            
}

function loadHosts(itemId){//获取推荐者列表，可能有多个
    $.ajax({
        url:"https://data.shouxinjk.net/_db/sea/user/users/",
        type:"get",
        data:{itemId:itemId},
        success:function(data){
            showHosts(data);
        }
    })
}

function loadCategories(currentCategory){
    $.ajax({
        url:"https://data.shouxinjk.net/_db/sea/category/categories",
        type:"get",
        success:function(msg){
            var navObj = $(".navUl");
            for(var i = 0 ; i < msg.length ; i++){
                navObj.append("<li data='"+msg[i]._key+"'>"+msg[i].name+"</li>");
                if(currentCategory == msg[i]._key)//高亮显示当前选中的category
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
    if(app.globalData.userInfo && app.globalData.userInfo._key){//如果为注册用户，则使用当前用户
        shareUserId = app.globalData.userInfo._key;
    }

    //准备分享url，需要增加分享的 fromUser、fromBroker信息
    var shareUrl = window.location.href;
    if(shareUrl.indexOf("?")>0){//如果本身带有参数，则加入到尾部
        shareUrl += "&fromUser="+shareUserId;
        shareUrl += "&fromBroker="+shareBrokerId;
    }else{//否则作为第一个参数增加
        shareUrl += "?fromUser="+shareUserId;
        shareUrl += "&fromBroker="+shareBrokerId;        
    }
    $.ajax({
        url:app.config.auth_api+"/wechat/jssdk/ticket",
        type:"get",
        data:{url:window.location.href},//重要：微信分享的URL必须和浏览器浏览地址保持一致！！
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
                    title:stuff?stuff.title:"小确幸，大生活", // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:stuff?stuff.images[0]:"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(11)+".jpeg", // 分享图标
                    success: function () {
                        // 用户点击了分享后执行的回调函数
                        logstash(stuff,"mp","share timeline",shareUserId,shareBrokerId,function(){
                            console.log("分享到朋友圈");
                        }); 
                    },
                });
                //分享给朋友
                wx.onMenuShareAppMessage({
                    title:stuff?stuff.title:"小确幸，大生活", // 分享标题
                    desc:stuff&&stuff.tags?stuff.tags.join(" "):"Live is all about having a good time.", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: stuff?stuff.images[0]:"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(11)+".jpeg", // 分享图标
                    type: 'link', // 分享类型,music、video或link，不填默认为link
                    dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
                    success: function () {
                      // 用户点击了分享后执行的回调函数
                        logstash(stuff,"mp","share appmsg",shareUserId,shareBrokerId,function(){
                            console.log("分享到微信");
                        }); 
                    }
                });            
            });
        }
    })    
}
