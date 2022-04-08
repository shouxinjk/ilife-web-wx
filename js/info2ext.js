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

    //显示遮罩层
    showPostMask();

    //加载内容
    loadItem(id); 
    
});

util.getUserInfo();//从本地加载cookie

//使用代理避免跨域问题。后端将代理到指定的URL地址。使用https
var imgPrefix = "https://www.biglistoflittlethings.com/3rdparty?url=";

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

//对于联联周边游、旅划算等，直接显示原始海报
function show3rdPartyPost(){
    $("#share-img").html("<img src='"+stuff.link.qrcode+"'/>");
    //隐藏原有元素
    $("#container").toggleClass("container-hide",true);
   $("#container").toggleClass("container",false);

    //显示图片
   $("#share-img").toggleClass("share-img-hide",false);
   $("#share-img").toggleClass("share-img-show",true);
   //修改图片尺寸
    $("#share-img img").css({
        "width": galleryWidth*0.8 + "px"
    });       
    //显示提示文字
   $("#share-img-tips").toggleClass("share-img-tips-hide",false);
   $("#share-img-tips").toggleClass("share-img-tips-show",true);
   //显示重新生成链接，可以重新刷新页面
   $("#error-link").html("<a href='"+window.location.href+"'>重新生成海报</a>");
   $("#error-link").toggleClass("share-img-tips-hide",false);
   $("#error-link").toggleClass("share-img-tips-show",true);       

     //隐藏提示信息
   $("#post-mask").toggleClass("post-mask-show",false);
   $("#post-mask").toggleClass("post-mask-hide",true);    
    $("#post-mask").html("长按海报保存或分享"); 
}

function showPostMask(){
    var shareContent = document.querySelector("#container");//需要截图的包裹的（原生的）DOM 对象：注意，必须是原生DOM对象，不能是jQuery对象
    var width = shareContent.offsetWidth; //获取dom 宽度
    var height = shareContent.offsetHeight; //获取dom 高度
    $("#post-mask").css({
        "width": document.body.clientWidth+"px",
        "height": "1200px",
    });      
}

//生成短连接及二维码
function generateQrcode(){
    console.log("start generate qrcode......");
    var longUrl = window.location.href.replace(/info2ext/g,"info").replace(/fromBroker/g,"fromBrokerOrigin").replace(/fromUser/g,"fromUserOrigin");//获取分享目标链接
    longUrl += "&fromBroker="+broker.id;
    longUrl += "&fromUser="+(app.globalData.userInfo._key?app.globalData.userInfo._key:"");   
    
    //生成短码并保存
    var shortCode = generateShortCode(longUrl);
    console.log("got short code",shortCode);
    saveShortCode(hex_md5(longUrl),id,fromBroker,fromUser,"mp",encodeURIComponent(longUrl),shortCode);    
    var shortUrl = "https://www.biglistoflittlethings.com/ilife-web-wx/s.html?s="+shortCode;//必须是全路径
    var logoUrl = imgPrefix+app.globalData.userInfo.avatarUrl;//需要中转，否则会有跨域问题

    //生成二维码
    var qrcode = new QRCode(document.getElementById("app-qrcode-box"), {
        text: shortUrl,
        width: 96,
        height: 96,    
        drawer: 'png',
        logo: logoUrl,
        logoWidth: 24,
        logoHeight: 24,
        logoBackgroundColor: '#ffffff',
        logoBackgroundTransparent: false
    });  
    setTimeout(generateImage,1200);
}

/////////////////////////////////////////////////////////////////////////////////////////
//以下用于优化海报生成。当前promise.finally不支持，不能工作

//预加载图片，便于生成完整海报
const preloadList = [];

/**
const preloadImg = (src) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve();
        }
        img.src = src;
    });
}

Promise.all(preloadList.map(src => preloadImg(src))).then(async () => {
    convertToImage(container).then(canvas => {
        // ...
    })
});
//**/

// 返回图片Blob地址
const toBlobURL = (function () {
    const urlMap = {};

    // @param {string} url 传入图片资源地址
    return function (url) {
        // 过滤重复值
        if (urlMap[url]) return Promise.resolve(urlMap[url]);

        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = document.createElement('img');

            img.src = url;
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                // 关键👇
                canvas.toBlob((blob) => {
                    const blobURL = URL.createObjectURL(blob);

                    resolve(blobURL);
                });
            };
            img.onerror = (e) => {
                reject(e);
            };
        });
    };
}());

// 批量处理
function convertToBlobImage(targetNode, timeout) {
    if (!targetNode) return Promise.resolve();

    let nodeList = targetNode;

    if (targetNode instanceof Element) {
        if (targetNode.tagName.toLowerCase() === 'img') {
            nodeList = [targetNode];
        } else {
            nodeList = targetNode.getElementsByTagName('img');
        }
    } else if (!(nodeList instanceof Array) && !(nodeList instanceof NodeList)) {
        throw new Error('[convertToBlobImage] 必须是Element或NodeList类型');
    }

    if (nodeList.length === 0) return Promise.resolve();

    // 仅考虑<img>
    return new Promise((resolve) => {
        let resolved = false;

        // 超时处理
        if (timeout) {
            setTimeout(() => {
                if (!resolved) resolve();
                resolved = true;
            }, timeout);
        }

        let count = 0;

        // 逐一替换<img>资源地址
        for (let i = 0, len = nodeList.length; i < len; ++i) {
            const v = nodeList[i];
            let p = Promise.resolve();

            if (v.tagName.toLowerCase() === 'img') {
                p = toBlobURL(v.src).then((blob) => {
                    v.src = blob;
                });
            }

            p.finally(() => {
                if (++count === nodeList.length && !resolved) resolve();
            });
        }
    });
}
/////////////////////////////////////////////////////////////////////////////////////////**/

//生成分享图片
function generateImage() {
    //console.log("preloadList",preloadList);
    var shareContent = document.querySelector("#container");//需要截图的包裹的（原生的）DOM 对象：注意，必须是原生DOM对象，不能是jQuery对象
    var width = shareContent.offsetWidth; //获取dom 宽度
    var height = shareContent.offsetHeight; //获取dom 高度
    var canvas = document.createElement("canvas"); //创建一个canvas节点
    //var canvas = document.querySelector("#canvas");
    var scale = 2;//DPR(); //定义任意放大倍数 支持小数:【注意在css中需要对目标元素设置 transform: 1/scale】
    canvas.width = width * scale; //定义canvas 宽度 * 缩放
    canvas.height = height * scale; //定义canvas高度 *缩放
    $(shareContent).css({
        "transform": "scale("+1/scale+")",
    });
    //canvas.style.width = width; //画布缩放到可视区域
    //canvas.style.height = height; //画布缩放到可视区域
    //var canvasStyle = window.getComputedStyle(shareContent);
    //canvas.width = parseInt(canvasStyle.width,10) * scale;
    //canvas.height = parseInt(canvasStyle.height,10) * scale;    
    //shareContent.ownerDocument.defaultView.innerHeight = shareContent.clientHeight;
    //shareContent.ownerDocument.defaultView.innerWidth = shareContent.clientWidth;
    canvas.getContext("2d").scale(scale, scale); //获取context,设置scale 
    var opts = {
        scale: scale, // 添加的scale 参数
        canvas: canvas, //自定义 canvas
        logging: true, //日志开关，便于查看html2canvas的内部执行流程
        width: width, //dom 原始宽度
        height: height,
        useCORS: true, // 【重要】开启跨域配置
    };
    //console.log("opts",opts);
    html2canvas(shareContent, opts).then(function (canvas) {
        //console.log("start convert...1");
        var context = canvas.getContext('2d');
        // 【重要】关闭抗锯齿
        context.mozImageSmoothingEnabled = false;
        context.webkitImageSmoothingEnabled = false;
        context.msImageSmoothingEnabled = false;
        context.imageSmoothingEnabled = false;
        //console.log("start convert...2",canvas.width,canvas.height);
        //【重要】将图片内容转化为blob，避免出现加载不完整的情况
        //convertToBlobImage(document.querySelector("img"));//直接处理所有图片
        // 【重要】默认转化的格式为png,也可设置为其他格式
        var img = Canvas2Image.convertToJPEG(canvas, canvas.width, canvas.height);
        //console.log("image generated.",img);
        //document.querySelector("#share-img").appendChild(img);
        $("#share-img").html(img);

        $(img).css({
            "width": canvas.width / scale + "px",
            "height": canvas.height / scale + "px",
        });
        //隐藏原有元素
        $("#container").toggleClass("container-hide",true);
       $("#container").toggleClass("container",false);

        //显示图片
       $("#share-img").toggleClass("share-img-hide",false);
       $("#share-img").toggleClass("share-img-show",true);
       //修改图片尺寸
        $("#share-img img").css({
            "width": canvas.width/scale*0.85 + "px",
            "height": canvas.height/scale*0.85 + "px"
        });       
        //显示提示文字
       $("#share-img-tips").toggleClass("share-img-tips-hide",false);
       $("#share-img-tips").toggleClass("share-img-tips-show",true);
       //显示重新生成链接，可以重新刷新页面
       $("#error-link").html("<a href='"+window.location.href+"'>重新生成海报</a>");
       $("#error-link").toggleClass("share-img-tips-hide",false);
       $("#error-link").toggleClass("share-img-tips-show",true);       

         //隐藏提示信息
       $("#post-mask").html("长按海报保存或分享"); 
       $("#post-mask").toggleClass("post-mask-show",false);
       $("#post-mask").toggleClass("post-mask-hide",true);    
    });
}

//将item显示到页面
function showContent(item){
    //标题
    $("#item-title").html(item.title);

    //图片
    $("#item-logo").append("<img src='" +imgPrefix+ item.images[0] + "' width='80%'/>");//正文图片

    //使用类目作为推荐语
    var advice = "用小确幸填满你的大生活";
    if(item.category&&Array.isArray(item.category)&&item.category.length>0){//如果是列表，取最后一项
        advice = item.category[item.category.length-1];
    }else if(item.category&&item.category.length>0){//如果是字符串则直接使用
        advice = item.category;
    }else if(item.props&&item.props.brand&&item.props.brand.trim().length>0){//有品牌则直接使用
        advice = item.props.brand;
    }else if(item.tagging&&item.tagging.length>0){//如果有tagging，则分割后采用第一条
        advice = item.tagging.split(" ")[0];
    }else{
        //留空，采用默认值
    } 

    //$("#shop-name").html(item.category&&item.category.length>0?item.category[0]:""); //店铺名称   
    $("#shop-name").html(advice); //店铺名称   

    //logo：注意使用代理避免跨域问题
    preloadList.push(imgPrefix+app.globalData.userInfo.avatarUrl);//将图片加入预加载列表
    $("#broker-logo").html("<img src='"+imgPrefix+app.globalData.userInfo.avatarUrl+"'/>");
 
    //二维码：使用海报图，将其中二维码进行裁剪
    /*
    if(item.link.qrcode){
        $("#qrcodeImg").attr("src",item.link.qrcode);
        $('#qrcodeImg').addClass('qrcode-'+item.source);//应用对应不同source的二维码裁剪属性
        $('#qrcodeImgDiv').addClass('qrcode-'+item.source+'-div');//应用对应不同source的二维码裁剪属性
        $("#qrcodeImgDiv").css('visibility', 'visible');
        $("#jumpbtn").text('长按下面的图片扫码购买');
    }else if(item.link.token && item.link.token.trim().length>0){//如果是口令
        $('#jumpbtn').attr('data-clipboard-text',item.link.token);//将口令预先设置好    
        $('#jumpbtn').html("复制口令并前往"+item.distributor.name);
    }
    //**/

    //trace user action
    /*
    logstash(item,from,"share-post",fromUser,fromBroker,function(){
        //do nothing
    });      
    //*/
    
    //分享海报日志
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
    logstash(stuff,"mp","share poster",shareUserId,shareBrokerId,function(res){
        console.log("分享海报",res);
    }); 

}

//根据openid查询加载broker
function loadBrokerByOpenid(openid) {
    console.log("try to load broker info by openid.[openid]",openid);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokerByOpenid/"+openid, function (res) {
        console.log("load broker info.",openid,res);
        if (res.status) {
            broker = res.data;    
            //填写清单信息
            $("#broker-name").html((broker.name?broker.name:app.globalData.userInfo.nickName)+ " 推荐");    //默认作者为当前broker    
            if(stuff&&stuff.link&&stuff.link.qrcode){//直接用原始二维码图片
                show3rdPartyPost();
            }else{//生成达人专属二维码，并在二维创建后生成海报
                generateQrcode();   
            }  
        }
        //加载达人后再注册分享事件：此处是二次注册，避免达人信息丢失。
        registerShareHandler();
    });
}

function loadItem(key){//获取内容列表
    $.ajax({
        url:"https://data.shouxinjk.net/_db/sea/my/stuff/"+key,
        type:"get",
        data:{},
        success:function(data){
            console.log("load item.", data);
            stuff = data;//本地保存，用于分享等后续操作
            //准备生成海报：
            //将图片加入到预加载列表内：
            preloadList.push(imgPrefix+stuff.images[0]);
            showContent(stuff);

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
    if(stuff&&stuff.source=="jd"){//如果是京东，则需要指明跳转到shouxinjk.net
        shareUrl += "&toSite=shouxinjk"; 
    }
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
                    imgUrl: stuff?stuff.images[0]:"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg", // 分享图标
                    type: 'link', // 分享类型,music、video或link，不填默认为link
                    dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
                    success: function () {
                      // 用户点击了分享后执行的回调函数
                        logstash(stuff,"mp","share appmsg",shareUserId,shareBrokerId,function(res){
                            console.log("分享到微信",res);
                        }); 
                    }
                });            
            });
        }
    })    
}
