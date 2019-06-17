// 文档加载完毕后执行
$(document).ready(function ()
{
    //根据屏幕大小计算字体大小
    const oHtml = document.getElementsByTagName('html')[0]
    const width = oHtml.clientWidth;
    var rootFontSize = 12 * (width / 1440);// 在1440px的屏幕基准像素为12px
    rootFontSize = rootFontSize <8 ? 8:rootFontSize;//最小为8px
    oHtml.style.fontSize = rootFontSize+ "px";
    //设置正文部分宽度
    var bodyWidth = 960*width/1440; //1440分辨率下显示960宽度
    $("#body").width(bodyWidth);
    galleryWidth = bodyWidth*0.7;//占比70%，960下宽度为672
    galleryHeight = 9*galleryWidth/16;//宽高比为16:9
    $("#main").width(galleryWidth);
    //处理参数
    var args = getQuery();
    var category = args["category"]; //当前目录
    var id = args["id"];//当前内容
    //判断屏幕大小，如果是小屏则跳转
    if(width<800){
        window.location.href=window.location.href.replace(/info.html/g,"info2.html");
    }
    //当前浏览内容
    var stuff=null;
    //加载导航和内容
    loadCategories(category);
    loadItem(id);   
    loadHosts(id);
    registerShareHandler();
    //注册搜索事件
    $(document).keydown(function(event){//注册搜索事件
    if(event.keyCode==13){
        tagging = $(".search input").val().trim();
        window.location.href="index.html?keyword="+tagging;
    }
    });
});

util.getUserInfo();//从本地加载cookie

var galleryWidth = 673;
var galleryHeight = 378;

//将item显示到页面
function showContent(item){
    //左侧：
    //标题与摘要
    $("#content").append("<div class='title'><a id='jumplink' href='#'>"+item.title+"</a></div>");//标题
    if(item.summary && item.summary.length>0)$("#content").append("<div class='summary'>"+item.summary+"</div>");//摘要
    // 标签
    //正文及图片
    for(var i=0;i<item.images.length;i++){
        $("#gallery").append("<li><img src='" + item.images[i] + "' alt=''/></li>");//加载图片幻灯
        $("#content").append("<img src='" + item.images[i] + "'/>");//正文图片
    }

    //初始化图片幻灯
    $('#gallery').galleryView({
        panel_width: galleryWidth,
        panel_height: galleryHeight,
        frame_width: 80,
        frame_height: 60
    }); 

    //右侧：
    //摘要：价格：优惠价与原价/评分/评价数；匹配度指数

    //购买按钮
    /*
    if(item.distributor && item.distributor.images && item.distributor.images.length>0)$("#shopping .summary").append("<img src='"+item.distributor.images[0]+"'/>");
    if(item.seller && item.seller.images && item.seller.images.length>0)$("#shopping .summary").append("<img src='"+item.seller.images[0]+"'/>");
    if(item.producer && item.producer.images && item.producer.images.length>0)$("#shopping .summary").append("<img src='"+item.producer.images[0]+"'/>");
    //*/
    $("#jumplink").click(function(){jump(item);}); 
    $("#jumpbtn").click(function(){jump(item);});   
    $("#title").click(function(){jump(item);}); 
    //标题
    $("#title").html(item.title);
    //评分
    if(item.rank.score){
        $("#score .comment").append("<div class='label'>评价</div><div class='rank'>"+item.rank.score+"/<span class='base'>"+item.rank.base+"</span></div>");
    }else{
        $("#score .comment").append("<div class='label'>评价</div><div class='rank'><span class='empty'>暂无评分</span></div>");
    }
    $("#score .price").append("<div class='label'>价格</div><div class='price-sale'><span class='price-bid'>"+(item.price.bid?item.price.bid:"")+"</span>"+item.price.sale+"</div>");
    //$("#score .price").append("<div class='label'>价格</div><div class='price-sale'>"+item.price.sale+"</div>");
    $("#score .score").append("<div class='label'>推荐度</div><div class='match'>"+(item.rank.match*100)+"%</div>");

    //二维码：使用海报图，将其中二维码进行裁剪
    if(item.link.qrcode){
        $("#qrcodeImg").attr("src",item.link.qrcode);
        $('#qrcodeImg').addClass('qrcode-'+item.source);//应用对应不同source的二维码裁剪属性
        $('#qrcodeImgDiv').addClass('qrcode-'+item.source+'-div');//应用对应不同source的二维码裁剪属性
        $("#qrcodeImgDiv").css('visibility', 'visible');
        $("#jumpbtn").text('扫码购买');
    }
        
    //推荐者列表
    //标签云
    if(item.distributor && item.distributor.name){//来源作为标签
        $("#tags").append("<div class='tag'>"+item.distributor.name+"</div>");
    }
    for(var i=0;i<item.tags.length;i++){
        $("#tags").append("<div class='tag'>" + item.tags[i] + "</div>");
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
    //TODO
    //trace user action
    logstash(item,"web","view",function(){
        //do nothing
    });    
}

//点击跳转到原始链接
function jump(item){//支持点击事件
    //console.log(item.id,item.url);
    logstash(item,"web","buy",function(){
        var target = item.url;
        if(item.link.qrcode){
            //it is a QRCODE
            $("#jumpbtn").text("扫码购买哦");
        }else if(item.link.web2){
            target = item.link.web2;
            window.location.href = target;
        }else if(item.link.web){
            target = item.link.web;
            window.location.href = target;
        }else{
            //there is no url link to jump
            //it is a QRCODE
            $("#jumpbtn").text("啊哦，这货现在买不了");
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
    var template="<div class='person'>"+
    "<div class='logo'><img src='__imgSrc' alt='__name'/></div>"+//image
    "<div class='name'>__name</div>"+//name
    "<div class='connection'><button type='button' class='btn __status'>__text</button></div>"+//button
    "</div>";
    for(var i=0;i<hosts.length;i++){
        var h = hosts[i];
        var hostEl = template.replace(/__imgSrc/g,h.avatarUrl)
            .replace(/__name/g,h.nickName)
            .replace(/__status/g,"toconnect")
            .replace(/__text/g,"+关注");
        $("#author").append(hostEl);
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
    $.ajax({
        url:app.config.auth_api+"/wechat/jssdk/ticket",
        type:"get",
        data:{url:window.location.href},
        success:function(json){
            wx.config({
                debug:false, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
                appId: json.appId, // 必填，公众号的唯一标识
                timestamp:json.timestamp , // 必填，生成签名的时间戳
                nonceStr: json.nonceStr, // 必填，生成签名的随机串
                signature: json.signature,// 必填，签名
                jsApiList: [
                    'onMenuShareTimeline', 'onMenuShareAppMessage',
                    'onMenuShareQQ', 'onMenuShareWeibo', 'onMenuShareQZone'
                ] // 必填，需要使用的JS接口列表
            });
            wx.ready(function() {
                // config信息验证后会执行ready方法，所有接口调用都必须在config接口获得结果之后，config是一个客户端的异步操作，所以如果需要在页面加载时就调用相关接口，
                // 则须把相关接口放在ready函数中调用来确保正确执行。对于用户触发时才调用的接口，则可以直接调用，不需要放在ready函数中。
                //分享到朋友圈
                wx.onMenuShareTimeline({
                    title:stuff?stuff.title:"小确幸，大生活", // 分享标题
                    link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    imgUrl:stuff?stuff.images[0]:"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(12)+".jpeg", // 分享图标
                    success: function () {
                        // 用户点击了分享后执行的回调函数
                        logstash(item,"mp","share-timeline",function(){
                            console.log("分享到朋友圈");
                        }); 
                    },
                });
                //分享给朋友
                wx.onMenuShareAppMessage({
                    title:stuff?stuff.title:"小确幸，大生活", // 分享标题
                    desc:stuff?stuff.tags:"Live is all about having a good time.", // 分享标题
                    link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    imgUrl: stuff?stuff.images[0]:"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(12)+".jpeg", // 分享图标
                    type: '', // 分享类型,music、video或link，不填默认为link
                    dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
                    success: function () {
                      // 用户点击了分享后执行的回调函数
                        logstash(item,"mp","share-appmsg",function(){
                            console.log("分享到微信");
                        }); 
                    }
                });            
            });
        }
    })  
}

