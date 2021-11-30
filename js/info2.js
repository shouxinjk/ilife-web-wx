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
    id = args["id"];//当前内容

    from = args["from"]?args["from"]:"mp";//可能为groupmessage,timeline等
    fromUser = args["fromUser"]?args["fromUser"]:"";//从连接中获取分享用户ID
    fromBroker = args["fromBroker"]?args["fromBroker"]:"";//从连接中获取分享达人ID。重要：将依据此进行收益计算


    //需要判定进入来源：如果是通过分享链接进入则要重新获取openid

    //判断屏幕大小，如果是大屏则跳转
    /**
    if(width>=800){
        window.location.href=window.location.href.replace(/info2.html/g,"info.html");
    }
    //**/

    //加载内容
    loadItem(id); 

    //加载导航和关注列表
    loadCategories(category);  
    //loadHosts(id);//不需要关注列表
    
});

util.getUserInfo();//从本地加载cookie

//临时用户
var tmpUser = "";

//item id
var id = "null";
var bonus = 0;

//当前浏览内容
var stuff=null;

var galleryWidth = 672;
var galleryHeight = 378;

//记录分享用户、分享达人
var from = "mp";//链接来源，默认为公众号进入
var fromUser = "";
var fromBroker = "";
var broker = {};//当前达人

//将item显示到页面
function showContent(item){
    //分享链接
    $("#share-link").attr("href","info2ext.html?id="+id);    
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

    //price
    $("#itemTagging-summary").append(htmlPrice(item));

/**    
    //评分
    if(item.rank && item.rank.score){
        $("#score .comment").append("<div class='label'>评价</div><div class='rank'>"+item.rank.score+"/<span class='base'>"+item.rank.base+"</span></div>");
    }else{
        $("#score .comment").append("<div class='label'>评价</div><div class='rank'><span class='empty'>暂无评分</span></div>");
    }    
    //$("#score .comment").append("<div class='label'>评价</div><div class='rank'>"+item.score.rank+"/<span class='base'>"+item.score.base+"</span></div>");
    var priceHtml = "<div class='label'>价格</div>";
    if(item.price.bid && item.price.bid>item.price.sale){//如果有降价信息则优先显示
        if(item.price.coupon && item.price.coupon>0){//如果有券则显示领券标志
            priceHtml+= "<div class='price-sale'><span class='couponTipBox'>券</span><span class='price-bid'>"+item.price.bid+"</span>"+item.price.sale+"</div>";
        }else{//否则显示原价
            priceHtml+= "<div class='price-sale'><span class='price-bid'>"+item.price.bid+"</span>"+item.price.sale+"</div>";
        }
    }else if(item.price.coupon && item.price.coupon>0){//否则显示券的具体金额
        priceHtml+= "<div class='price-sale'><span class='couponTip'>券</span><span class='price-coupon'>"+item.price.coupon+"</span>"+item.price.sale+"</div>";
    }else{//只有最终售价
        priceHtml+= "<div class='price-sale'>"+item.price.sale+"</div>";
    }
    $("#score .price").append(priceHtml);

    $("#score .score").append("<div class='label'>推荐度</div><div class='match'>"+(item.rank&&item.rank.match?item.rank.match*100+"%":"-")+"</div>");
//**/

    //二维码：使用海报图，将其中二维码进行裁剪
    if(item.link.qrcode){
        $("#qrcodeImg").attr("src",item.link.qrcode);
        $('#qrcodeImg').addClass('qrcode-'+item.source);//应用对应不同source的二维码裁剪属性
        $('#qrcodeImgDiv').addClass('qrcode-'+item.source+'-div');//应用对应不同source的二维码裁剪属性
        $("#qrcodeImgDiv").css('visibility', 'visible');
        $("#jumpbtn").text('长按下面的图片扫码购买');
    }else if(item.link.token && item.link.token.trim().length>0){//如果是口令
        var tokenStr = item.link.token; //默认是系统推广口令
        if(broker.id&&item.link.cps[broker.id]&&item.link.cps[broker.id].token&&item.link.cps[broker.id].token.trim().length>0){//如果有达人口令，则使用达人口令
            tokenStr = item.link.cps[broker.id].token;
        }
        $('#jumpbtn').attr('data-clipboard-text',tokenStr);//将口令预先设置好    
        $('#jumpbtn').html("复制口令并前往"+item.distributor.name);
    }

    //标签
    if(item.distributor && item.distributor.name){//来源作为标签
        $("#tags").append("<div class='tag'>"+item.distributor.name+"</div>");
    }    
    for(var i=0;item.tags&&i<item.tags.length;i++){//标签云
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

    //显示跳转按钮
    $("#jumpbtn").removeClass("buy-btn-hide");
    $("#jumpbtn").addClass("buy-btn-show");

    //广告
    //trace user action
    logstash(item,from,"view",fromUser,fromBroker,function(){
        //do nothing
    });      
}

//分享浮框
function showShareContent(){
    //显示分享卡片
   $("#share-box").toggleClass("share-box",true);
   $("#share-box").toggleClass("share-box-hide",false);  

    var strBonus = "";
    if(bonus>0){
        strBonus += "返￥"+(parseFloat((Math.floor(bonus*10)/10).toFixed(1))>0?parseFloat((Math.floor(bonus*10)/10).toFixed(1)):parseFloat((Math.floor(bonus*10)/10).toFixed(2)));
    }else{
        strBonus = "推广积分";
    }
    //if(strBonus.length > 0){//所有商品都显示分享卡片
        $("#share-bonus").html(strBonus);
        $("#share-bonus").toggleClass("share-bonus",true);
        $("#share-bonus").toggleClass("share-bonus-hide",false);  
    /**
    }else{
       $("#share-bonus").toggleClass("share-bonus",false);
       $("#share-bonus").toggleClass("share-bonus-hide",true);        
    }
    //**/
}

//价格标签
function htmlPrice(item){
    var tags = "";
    tags += "<a class='itemTagPrice' href='#'>"+(item.price&&item.price.currency?item.price.currency:"¥")+item.price.sale+"</a>";
    if(item.price&&item.price.coupon>0){//优惠信息
        tags += "<span class='couponTip'>券</span><span class='coupon' href='#'>"+item.price.coupon+"</span>";
    }      
    var tagTmplBlank = "<a class='itemTagBlank' href='index.html?keyword=__TAGGING'>__TAG</a>";
    tags += tagTmplBlank.replace("__TAGGING",item.distributor.name).replace("__TAG",item.distributor.name);    
    if(item.producer&&item.producer.name)
        tags += tagTmplBlank.replace("__TAGGING",item.producer.name).replace("__TAG",item.producer.name); 
    if(item.seller&&item.seller.name)
        tags += tagTmplBlank.replace("__TAGGING",item.seller.name).replace("__TAG",item.seller.name); 
    return tags;
}

//佣金
function htmlItemProfitTags(item){
    var profitTags = "";
    //因为已经确认过是达人，这里直接显示即可
    console.log("\n\n==profit==",item.profit);
    if(item.profit&&item.profit.type=="3-party"){//如果已经存在则直接加载
      if(item.profit&&item.profit.order){
          profitTags += "<span class='profitTipOrder'>店返</span><span class='itemTagProfitOrder' href='#'>¥"+(parseFloat((Math.floor(item.profit.order*10)/10).toFixed(1)))+"</span>";
          if(item.profit&&item.profit.team&&item.profit.team>0.1)profitTags += "<span class='profitTipTeam'>团返</span><span class='itemTagProfitTeam' href='#'>¥"+(parseFloat((Math.floor(item.profit.team*10)/10).toFixed(1)))+"</span>";
      }else if(item.profit&&item.profit.credit&&item.profit.credit>0){
          profitTags += "<span class='profitTipCredit'>积分</span><span class='itemTagProfitCredit' href='#'>"+(parseFloat((Math.floor(item.profit.credit*10)/10).toFixed(0)))+"</span>";
      }
    }else if(item.profit && item.profit.type=="2-party"){//如果是2方分润则请求计算
        profitTags = "<div id='profit"+item._key+"' class='itemTags profit-hide'></div>";
        getItemProfit2Party(item);
    }else{//表示尚未计算。需要请求计算得到该item的profit信息
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
        //更新到item
        if(item.profit==null){
          item.profit={};
        }        
        item.profit.order = res.order;
        item.profit.team = res.team;
        item.profit.credit = res.credit;
        item.profit.type = "3-party";   
        updateItem(item);       
    },"GET",data);
}

//查询佣金。2方分润。返回order/team/credit三个值
function getItemProfit2Party(item) {
    var data={
        source:item.source,
        price:item.price.sale,
        amount:item.profit.amount?item.profit.amount:0,
        category:item.categoryId?item.categoryId:""
    };
    console.log("try to query item profit -- 2 party",data);
    util.AJAX(app.config.sx_api+"/mod/commissionScheme/rest/profit-2-party", function (res) {
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
        //更新到item
        if(item.profit==null){
          item.profit={};
        }        
        item.profit.order = res.order;
        item.profit.team = res.team;
        item.profit.credit = res.credit;
        item.profit.type = "3-party";   
        updateItem(item);      
    },"GET",data);
}

//更新item信息。只用于更新profit
function updateItem(item) {
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };   
    var url = app.config.data_api +"/_api/document/my_stuff/"+item._key;
    if (app.globalData.isDebug) console.log("Info2::updateItem update item.",item);
    util.AJAX(url, function (res) {
      if (app.globalData.isDebug) console.log("Info2::updateItem update item finished.", res);
      //需要重新提交索引， 否则首页无法显示
      index(item);
    }, "PATCH", item, header);
}

//提交索引
function index(item){//记录日志
    var data = {
        records:[{
            value:item
        }]
    };
    $.ajax({
        url:"http://kafka-rest.shouxinjk.net/topics/stuff",
        type:"post",
        data:JSON.stringify(data),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/vnd.kafka.json.v2+json",
            "Accept":"application/vnd.kafka.v2+json"
        },
        success:function(result){
            console.log("update index success.");
        }
    })            
}

//根据openid查询加载broker
function loadBrokerByOpenid(openid) {
    //console.log("try to load broker info by openid.[openid]",openid);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokerByOpenid/"+openid, function (res) {
        //console.log("load broker info.",openid,res);
        if (res.status) {//将佣金信息显示到页面
            broker = res.data;
            //显示评价图：TODO 当前仅用于测试
            if(broker.openid=="o8HmJ1EdIUR8iZRwaq1T7D_nPIYc" || broker.openid=="o8HmJ1ItjXilTlFtJNO25-CAQbbg"){
                //显示雷达图
                showRadar();
            }

            //达人佣金
            var profitHtml = htmlItemProfitTags(stuff);
            if(profitHtml.trim().length>0){
                $("#profit").html(profitHtml);
                $("#profit").toggleClass("profit-hide",false);
                $("#profit").toggleClass("profit-show",true);
            }
            //显示分享按钮
            console.log("Board::insertBoardItem load share info.", stuff);
            if(stuff.profit && stuff.profit.order && stuff.profit.order >0){
                if( stuff.profit.order > bonus){
                    bonus = stuff.profit.order;
                }
                //showShareContent();//显示分享card
            }
            showShareContent();//注意，所有单个商品均显示分享卡片            
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
    logstash(item,from,"buy",fromUser,benificiaryBrokerId,function(){
        var target = item.url;
        if(item.link.qrcode){//如果是二维码
            //it is a QRCODE
            $("#jumpbtn").text("长按下面的图片扫码购买哦");
        }else if(item.link.token && item.link.token.trim().length>0){//如果是口令：这里直接拷贝，在加载时已经优先写入broker特定的口令
            var clipboard = new ClipboardJS('#jumpbtn');
            clipboard.on('success', function(e) {
                //$('#jumpbtn').attr('data-clipboard-text',item.link.token);
                //console.info('Action:', e.action);
                console.info('platform default token is copied:', e.text);
                $.toast({//浮框提示打开APP
                    heading: '需要在APP购买',
                    text: '口令已复制，打开'+item.distributor.name+'APP吧',
                    showHideTransition: 'fade',
                    icon: 'success'
                });              
                //e.clearSelection();
            });            
        }else if(item.link.cps && item.link.cps[benificiaryBrokerId] /* && item.link.cps[benificiaryBrokerId].wap*/){//能够直接获得达人链接则直接显示
            window.location.href = item.link.cps[benificiaryBrokerId]/*.wap*/;
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
            //更新到item，更新完成后跳转到cps链接地址
            updateBrokerCpsLink(item,brokerId,res.link);
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

//更新item信息：补充达人CPS链接
function updateBrokerCpsLink(item,brokerId,cpsLink) {
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };   
    var cps = {};
    cps[brokerId]=cpsLink;//yibrokerId为key，以cpslink为value
    var data = {link:{cps:cps}};
    var url = app.config.data_api +"/_api/document/my_stuff/"+item._key;
    if (app.globalData.isDebug) console.log("Info2::updateItem update item with broker cps link.[itemKey]"+item._key,data);
    $.ajax({
        url:url,
        type:"PATCH",
        data:JSON.stringify(data),//注意：nginx启用CORS配置后不能直接通过JSON对象传值
        headers:header,
        timeout:2000,//设置超时
        success:function(res){//正确返回则跳转到返回地址
          if (app.globalData.isDebug) console.log("Info2::updateItem update item finished.", res);
          //跳转到cps地址
          window.location.href = cpsLink;
        },
        complete: function (XMLHttpRequest, textStatus) {//调用执行后调用的函数
            if(textStatus == 'timeout'){//如果是超时，则直接跳转到cps地址，忽略更新stuff失败
              console.log("ajax timeout. jump to cps link directly.",textStatus);
              window.location.href = cpsLink;
            }
        },
        error: function () {//调用出错执行的函数
            console.log("error occured while update cps link to stuff. jump to cps link directly.");
            window.location.href = cpsLink;
          }

    });
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

            //显示评价树
            if(stuff.meta && stuff.meta.category)
                showDimensionBurst();

            ////多站点处理：start//////////////////////////////////
            //由于当前shouxinjk.net 和 biglistoflittlethings.com 两个网站分别到不同电商平台，需要进行分隔处理
            /**
            if(stuff.source == "jd"){//如果是京东则跳转到shouxinjk
                if(window.location.href.indexOf("shouxinjk.net")<0){//如果不是shouxinjk.net则跳转
                    var sxUrl = window.location.href.replace(/www\.biglistoflittlethings\.com/g,"www.shouxinjk.net");
                    sxUrl = sxUrl.replace(/https/g,"http");//注意：当前 www.shouxinjk.net仅支持 http。必须使用 http://www.shouxinjk.net作为地址，否则会导致导购信息丢失
                    window.location.href = sxUrl;
                }
            }
            //**/
            ////多站点处理：end////////////////////////////////////

            //准备注册分享事件。需要等待内容加载完成后才注册
            //判断是否为已注册用户
            if(app.globalData.userInfo&&app.globalData.userInfo._key){//表示是已注册用户
                loadBrokerByOpenid(app.globalData.userInfo._key);
                //注意：在加载完成后会注册分享事件，并用相应的broker进行填充
            }else{//直接注册分享分享事件，默认broker为system，默认fromUser为system
                console.log("cannot get user info. assume he is a new one.");
                //TODO:是不是要生成一个特定的编号用于识别当前用户？在注册后可以与openid对应上
                //检查cookie是否有标记，否则生成标记
                tmpUser = $.cookie('tmpUserId');
                if(tmpUser && tmpUser.trim().length>0){
                    console.log("there already has a temp code for this user.", tmpUser);
                }else{
                    tmpUser = "tmp-"+gethashcode();
                    console.log("there is no temp code for this user, generate one.", tmpUser);
                    $.cookie('tmpUserId', tmpUser, { expires: 3650, path: '/' });  
                }
                registerShareHandler();
            }            
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

//generate and show radar chart
//TODO: to query result for specified item
//step1: query featured measures by meta.category
//step2: query calculated featured measure data by itemKey
//step3: assemble single item dataset
//step 4-6 : query and assemble category average data set
//step 7: show radar chart
function showRadar(){
    var margin = {top: 60, right: 60, bottom: 60, left: 60},
        width = Math.min(700, window.innerWidth - 10) - margin.left - margin.right,
        height = Math.min(width, window.innerHeight - margin.top - margin.bottom - 20);
            
    //query item measure data
    var data = [
              [//iPhone
                {axis:"电池寿命",value:0.74},
                {axis:"品牌",value:0.56},
                {axis:"售后",value:0.72},
                {axis:"使用成本",value:0.58},
                {axis:"设计",value:0.94},
                {axis:"网络",value:0.64},
                {axis:"屏幕",value:0.04},
                {axis:"价格",value:0.42},
                {axis:"可用性",value:0.72},
                {axis:"美誉度",value:0.52},
                {axis:"潮流",value:0.48},
                {axis:"智能化",value:1.0}          
              ],[//Samsung
                {axis:"电池寿命",value:0.54},
                {axis:"品牌",value:0.132},
                {axis:"售后",value:0.56},
                {axis:"使用成本",value:0.7},
                {axis:"设计",value:0.76},
                {axis:"网络",value:0.80},
                {axis:"屏幕",value:0.26},
                {axis:"价格",value:0.7},
                {axis:"可用性",value:0.82},
                {axis:"美誉度",value:0.62},
                {axis:"潮流",value:0.7},                
                {axis:"智能化",value:0.76}
              ],[//Nokia Smartphone
                {axis:"电池寿命",value:0.52},
                {axis:"品牌",value:0.20},
                {axis:"售后",value:0.42},
                {axis:"使用成本",value:0.60},
                {axis:"设计",value:0.58},
                {axis:"网络",value:0.42},
                {axis:"屏幕",value:0.68},
                {axis:"价格",value:0.82},
                {axis:"可用性",value:0.92},
                {axis:"美誉度",value:0.7},
                {axis:"潮流",value:0.58},                
                {axis:"智能化",value:0.60}
              ]
            ];

    //generate radar chart.
    //TODO: to put in ajax callback
    var color = d3.scaleOrdinal(["#EDC951","#CC333F","#00A0B0"]);
        
    var radarChartOptions = {
      w: width,
      h: height,
      margin: margin,
      maxValue: 1,
      levels: 5,
      roundStrokes: true,
      color: color
    };
    //genrate radar
    RadarChart("#radar", data, radarChartOptions);
}

//图形化显示客观评价树
function showDimensionBurst(){
    //测试数据
    var testData=[
        {categoryId:"ff240a6e909e45c2ae0c8f77241cda25",categoryName:"目的地"},
        {categoryId:"7363d428d1f1449a904f5d34aaa8f1f7",categoryName:"亲子"},
        {categoryId:"91349a6a41ce415caf5b81084927857a",categoryName:"酒店"}
    ];
    var testDataIndex = new Date().getTime()%3;

    //根据category获取客观评价数据
    var data={
        categoryId:stuff.meta.category
        //categoryId:testData[testDataIndex].categoryId
        //categoryId:"ff240a6e909e45c2ae0c8f77241cda25" //目的地
        //categoryId:"7363d428d1f1449a904f5d34aaa8f1f7" //亲子
        //categoryId:"91349a6a41ce415caf5b81084927857a" //酒店 categoryId
        //,parentId:"d1668f8b3c9748cd806462a45651827b"
    };
    console.log("try to load dimension data.",data);
    util.AJAX(app.config.sx_api+"/mod/itemDimension/rest/dim-tree-by-category", function (res) {
        console.log("======\nload dimension.",data,res);
        if (res.length>0) {//显示图形
            //showSunBurst({name:testData[testDataIndex].categoryName,children:res});
            showSunBurst({name:stuff.meta.categoryName?stuff.meta.categoryName:"评价规则",children:res});
        }else{//没有则啥也不干
            //do nothing
            console.log("failed load dimension tree.",data);
        }
    },"GET",data);    
}

function showSunBurst(data){
    Sunburst("#sunburst",data, {
      value: d => d.weight, // weight 
      label: d => d.name, // name
      title: (d, n) => `${n.ancestors().reverse().map(d => d.data.name).join(".")}\n${n.value.toLocaleString("en")}`, // hover text
//      link: (d, n) => n.children
//        ? `https://github.com/prefuse/Flare/tree/master/flare/src/${n.ancestors().reverse().map(d => d.data.name).join("/")}`
//        : `https://github.com/prefuse/Flare/blob/master/flare/src/${n.ancestors().reverse().map(d => d.data.name).join("/")}.as`,
      width: 400,
      height: 400
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
    if(tmpUser&&tmpUser.trim().length>0){//如果是临时用户进行记录。注意有时序关系，需要放在用户信息检查之前。
        shareUserId = tmpUser;
    }
    if(app.globalData.userInfo && app.globalData.userInfo._key){//如果为注册用户，则使用当前用户
        shareUserId = app.globalData.userInfo._key;
    }

    //准备分享url，需要增加分享的 fromUser、fromBroker信息
    var shareUrl = window.location.href.replace(/info2/g,"share");//需要使用中间页进行跳转
    if(shareUrl.indexOf("?")>0){//如果本身带有参数，则加入到尾部
        shareUrl += "&fromUser="+shareUserId;
        shareUrl += "&fromBroker="+shareBrokerId;
    }else{//否则作为第一个参数增加
        shareUrl += "?fromUser="+shareUserId;
        shareUrl += "&fromBroker="+shareBrokerId;        
    }
    shareUrl += "&origin=item";//添加源，表示是一个单品分享

    ////多站点处理：start//////////////////////////////////
    //由于不同平台通过不同站点，需要进行区分是shouxinjk.net还是biglistoflittlethings.com
    /*
    if(stuff&&stuff.source=="jd"){//如果是京东，则需要指明跳转到shouxinjk.net
        shareUrl += "&toSite=shouxinjk"; 
    }
    //**/
    ////多站点处理：end////////////////////////////////////

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
                    title:stuff?stuff.title:"小确幸，大生活", // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:stuff?stuff.images[0]:"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(11)+".jpeg", // 分享图标
                    success: function () {
                        // 用户点击了分享后执行的回调函数
                        logstash(stuff,"mp","share timeline",shareUserId,shareBrokerId,function(res){
                            console.log("分享到朋友圈",res);
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
                        logstash(stuff,"mp","share appmsg",shareUserId,shareBrokerId,function(res){
                            console.log("分享到微信",res);
                        }); 
                    }
                });  
                //分享到微博
                wx.onMenuShareWeibo({
                    title:stuff?stuff.title:"小确幸，大生活", // 分享标题
                    desc:stuff&&stuff.tags?stuff.tags.join(" "):"Live is all about having a good time.", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: stuff?stuff.images[0]:"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(11)+".jpeg", // 分享图标
                    success: function () {
                      // 用户点击了分享后执行的回调函数
                        logstash(stuff,"mp","share weibo",shareUserId,shareBrokerId,function(res){
                            console.log("分享到微博",res);
                        }); 
                    }
                });                             
            });
        }
    })    
}
