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
    var id = args["id"];//当前board id

    from = args["from"]?args["from"]:"mp";//可能为groupmessage,timeline等
/**    
    fromUser = args["fromUser"]?args["fromUser"]:"";//从连接中获取分享用户ID
    fromBroker = args["fromBroker"]?args["fromBroker"]:"";//从连接中获取分享达人ID。重要：将依据此进行收益计算
    boardType = args["type"]?args["type"]:"board2-waterfall";//从连接中获取清单类型，默认为waterfall
    $('#waterfall').NewWaterfall({
        width: columnWidth,
        delay: 100,
    });  
//**/
    //显示遮罩层
    //showPostMask();

    //加载达人信息及二维码
    loadBrokerByOpenid(userInfo._key);//直接传递openid
    
});

util.getUserInfo();//从本地加载cookie
var userInfo=app.globalData.userInfo;//默认为当前用户

//使用代理避免跨域问题。通过代理提供同源图片服务。
var imgPrefix = "https://www.biglistoflittlethings.com/3rdparty?url=";

//分享清单格式：board2、board2-waterfall
var boardType = "board2-waterfall";//默认为图片流

//临时用户
var tmpUser = "";

var items = [];//board item 列表
var totalItems = 0;// 记录总共的item条数，由于是异步处理，需要对数量进行控制，避免数量过少时不能生成海报

var columnWidth = 800;//默认宽度600px
var columnMargin = 5;//默认留白5px
var galleryWidth = 672;
var galleryHeight = 378;
var num = 1;//需要加载的内容下标

//记录分享用户、分享达人
var from = "mp";//链接来源，默认为公众号进入
var fromUser = "";
var fromBroker = "";
var broker = {};//当前达人

function showPostMask(){
    var shareContent = document.querySelector("#container");//需要截图的包裹的（原生的）DOM 对象：注意，必须是原生DOM对象，不能是jQuery对象
    var width = shareContent.offsetWidth; //获取dom 宽度
    var height = shareContent.offsetHeight; //获取dom 高度
    $("#post-mask").css({
        "width": document.body.clientWidth+"px",
        "height": "1200px",
    });      
}

/////////////////////////////////////////////////////////////////////////////////////////
//以下用于优化海报生成。当前promise.finally不支持，不能工作
//**
Promise.prototype.finally = callback => {
    return this.then(
        value => this.constructor.resolve(callback()).then(() => value),
        reason => this.constructor.resolve(callback()).then(() => { throw reason })
    )
}
//**/

//预加载图片，便于生成完整海报
const preloadList = [];

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
    var scale = 3;//DPR(); //定义任意放大倍数 支持小数:【注意在css中需要对目标元素设置 transform: 1/scale】//验证设为4倍能够输出清晰图片
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
        scale: scale, // 添加的scale 参数：验证设为4倍能够输出清晰图片
        canvas: canvas, //自定义 canvas
        logging: true, //日志开关，便于查看html2canvas的内部执行流程
        width: width, //dom 原始宽度
        height: height,
        useCORS: true, // 【重要】开启跨域配置
//        allowTaint:false,
//        proxy:"https://www.biglistoflittlethings.com/3rdparty",
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
            "height": canvas.height/scale*0.85 + "px",
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

//根据openid查询加载broker
function loadBrokerByOpenid(openid) {
    console.log("try to load broker info by openid.[openid]",openid);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokerByOpenid/"+openid, function (res) {
        console.log("load broker info.",openid,res);
        if (res.status) {
            //insertBroker(res.data);//显示达人信息
            if(res.data.qrcodeUrl && res.data.qrcodeUrl.indexOf("http")>-1){//如果有QRcode则显示
                console.log("QRcode exists. try  to display.",imgPrefix+res.data.qrcodeUrl);
                preloadList.push(imgPrefix+res.data.qrcodeUrl);//将图片加入预加载列表
                showContent(res.data.qrcodeUrl);
            }else{//否则请求生成后显示
                requestQRcode(res.data);
            }
        }
    });
}

//请求生成二维码
function requestQRcode(broker) {
    console.log("try to request QRCode.[broker]",broker);
    util.AJAX(app.config.auth_api+"/wechat/ilife/qrcode?brokerId="+broker.id, function (res) {
        console.log("Generate QRCode successfully.",res);
        if (res.status) {
            preloadList.push(imgPrefix+res.data.url);//将图片加入预加载列表
            showContent(res.data.url);//显示二维码
        }
    });
}

//显示二维码
function showContent(url) {
    $("#broker-name").html(app.globalData.userInfo.nickName+ " 邀请");    //默认作者为board创建者
    $("#shop-name").html("分享赚钱，自购省钱<br/>一起用小确幸填满大生活"); //店铺名称
    //$("#content").html("用小确幸填满大生活"); //店铺名称
    //logo：注意使用代理避免跨域问题
    //preloadList.push(imgPrefix+app.globalData.userInfo.avatarUrl);//将图片加入预加载列表
    $("#broker-logo").html('<img src="'+imgPrefix+app.globalData.userInfo.avatarUrl+'"/>');   
    $("#qrcode").html('<img src="'+imgPrefix+url+'" width="200px" alt="分享二维码邀请达人加入"/>');
    //$("#qrcode").html('<div style="width:200px;height:200px">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>');
     var css2 = {
        height: "200px",
        width: "200px",
        display:"block"
    };
    $("#qrcode").css(css2); 
    //$("#qrcode").css("background-image","url(" + url+ ")"); 
       
    generateImage();//生成分享海报
}
