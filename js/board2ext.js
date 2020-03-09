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
    fromUser = args["fromUser"]?args["fromUser"]:"";//从连接中获取分享用户ID
    fromBroker = args["fromBroker"]?args["fromBroker"]:"";//从连接中获取分享达人ID。重要：将依据此进行收益计算
    boardType = args["type"]?args["type"]:"board2-waterfall";//从连接中获取清单类型，默认为waterfall
    $('#waterfall').NewWaterfall({
        width: columnWidth,
        delay: 100,
    });  

    //生成二维码：需要提前生成，避免时延导致显示不完整
    generateQRcode();

    //加载内容
    loadBoard(id); 
    //加载清单item列表
    loadBoardItems(id);
    
});

util.getUserInfo();//从本地加载cookie

//使用代理避免跨域问题。后端将代理到指定的URL地址
var imgPrefix = "http://www.biglistoflittlethings.com/3rdparty?url=";

//分享清单格式：board2、board2-waterfall
var boardType = "board2-waterfall";//默认为图片流

//临时用户
var tmpUser = "";

var items = [];//board item 列表

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
var board = {};//当前board

var boardItemTemplate = '<div class="board-item-wrapper">'+
                            '<div class="board-item-title">'+
                              '<span class="board-item-title-head">推荐__NUMBER</span>'+
                              '<span class="board-item-title-text">__TITLE</span>'+
                            '</div>'+   
                            '<div class="board-item-description">__DESCRIPTION</div>'+                                   
                        '</div>';

//生成短连接及二维码
function generateQRcode(){
    var qrcode = new QRCode("app-qrcode-box");
    var longUrl = window.location.href.replace(/board2ext/g,boardType);//获取分享目标链接
    var header={
        "Content-Type":"application/json"
    };
    util.AJAX(app.config.auth_api+"/wechat/ilife/short-url", function (res) {
        console.log("generate short url.",res);
        var shortUrl = longUrl;
        if (res.status) {//获取短连接
            shortUrl = res.data.url;
        }
        qrcode.makeCode(shortUrl);
    }, "POST", { "longUrl": longUrl },header);    
}

//将board内容显示到页面
function showContent(board){
    $("#broker-name").html(board.broker.name+ " 推荐");    //默认作者为board创建者
    $("#shop-name").html(board.title); //店铺名称
    //logo：注意使用代理避免跨域问题
    $("#broker-logo").html("<img src='"+imgPrefix+app.globalData.userInfo.avatarUrl+"'/>");

    //qrcode.makeCode(window.location.href.replace(/board2ext/g,"board2"));
    //$("#publish-time").html(board.updateDate.split(" ")[0]);   
    //摘要
    //$("#content").html(board.description);

    //TODO:记录board浏览历史
    /*
    logstash(item,from,"view",fromUser,fromBroker,function(){
        //do nothing
    });   
    //**/   
}


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

         //隐藏画布
       //$("#canvas").toggleClass("canvas-show",false);
       //$("#canvas").toggleClass("canvas-hide",true);      

    });
}

//根据openid查询加载broker
function loadBrokerByOpenid(openid) {
    console.log("try to load broker info by openid.[openid]",openid);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokerByOpenid/"+openid, function (res) {
        console.log("load broker info.",openid,res);
        if (res.status) {//将佣金信息显示到页面
            broker = res.data;
            $("#author").html(broker.name);    //如果当前用户是达人，则转为其个人board
        }
        //加载达人后再注册分享事件：此处是二次注册，避免达人信息丢失。
        registerShareHandler();
    });
}

//根据boardId查询board信息
function loadBoard(boardId){
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };     
    util.AJAX(app.config.sx_api+"/mod/board/rest/board/"+boardId, function (res) {
        console.log("Board::loadBoard load board successfully.", res)
        if(res.status){
            console.log("Board::loadBoard now insert board info.", res)
            board = res.data;
            showContent(res.data);

            //注册事件：根据关键词搜索更多
            $("#jumpToSearch").click(function(){
                window.location.href="index.html?keyword="+board.keywords;
            });            

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
    }, "GET",{},header);
}


//根据boardId查询所有item列表
function loadBoardItems(boardId){
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };     
    util.AJAX(app.config.sx_api+"/mod/boardItem/rest/board-items/"+boardId, function (res) {
        console.log("Board::loadBoardItems load board items successfully.", res)
        //装载具体条目
        var hits = res;
        for(var i = 0 ; i < hits.length; i++){ //限定最多5条
            loadBoardItem(hits[i]);//查询具体的item条目
        }        
        //insertBoardItem(); //显示到界面:注意需要将加载过程变为同步，否则会导致数据缺失
    }, "GET",{},header);
}


function loadBoardItem(item){//获取内容列表
    $.ajax({
        url:"https://data.shouxinjk.net/_db/sea/my/stuff/"+item.item,
        type:"get",
        //async: false,//如果是加载完成后一次性显示，则需要使用同步的方式,true为异步方式
        data:{},
        success:function(data){
            item.stuff = data;//装载stuff到boarditem   
            items.push(item); //装载到列表 
            insertBoardItem(); //显示到界面:避免反复刷新，在装载完成后一次性显示，注意改为同步加载
        }
    })            
}

//将item显示到页面。每一个item提供推荐标题、推荐描述编辑。并展示对应的itemlogo、来源、原始标题及tag
function insertBoardItem(){
    // 加载内容
    var item = items[num-1];
    if(!item)return;
    if(num>5){//仅加载5条，加载完成后生成图片
        generateImage();
        return;
    }

    var logoImg = "images/tasks/board.png";
    if(item.stuff && item.stuff.images && item.stuff.images.length>0){
        //logoImg = item.stuff.images[0];//默认用第一张图片做logo
        logoImg = imgPrefix+item.stuff.images[0];//对第三方图片使用代理，避免跨域问题
    }

    //显示所关联stuff内容
    var image = "<img src='"+logoImg+"' width='72'/>";
    var title = "<div class='board-item-title'>"+item.stuff.title+"</div>";

/////////////
    var tagTmpl = "<a class='itemTag' href='index.html?keyword=__TAGGING'>__TAG</a>";
    var highlights = "<div class='itemTags'>";
    highlights += "<a class='itemTagPrice' href='#'>"+(item.stuff.price.currency?item.stuff.price.currency:"¥")+item.stuff.price.sale+"</a>";
    if(item.stuff.price.coupon>0){
        highlights += "<span class='couponTip'>券</span><span class='coupon' href='#'>"+item.stuff.price.coupon+"</span>";
    }    
    highlights += tagTmpl.replace("__TAGGING",item.stuff.distributor.name).replace("__TAG",item.stuff.distributor.name).replace("itemTag","itemTagDistributor");
    highlights += "</div>";

    var tags = "<div class='itemTags'>";
    var taggingList = item.stuff.tagging.split(" ");
    for(var t in taggingList){
        var txt = taggingList[t];
        if(txt.trim().length>1 && txt.trim().length<6){
            tags += tagTmpl.replace("__TAGGING",txt).replace("__TAG",txt);
        }
    }
    if(item.categoryId && item.categoryId.trim().length>1){
        tags += tagTmpl.replace("__TAGGING",item.stuff.category).replace("__TAG",item.stuff.category);
    }
    tags += "</div>";
/////////////

    $("#waterfall").append("<li>"+
        '<div class="board-item-seperator'+(num>1?"-short":"-long")+'"></div>'+
        '<div class="board-item">'+
            '<div class="board-item-head">'+
              '<div class="board-item-head-no-'+num+'">NO.'+num+'  </div>'+
              //"<div class='board-item-head-tag'>"+((item.stuff.tags&&item.stuff.tags.length>0)?item.stuff.tags[0]:"")+"</div>"+
            '</div>'+ 
            "<div class='board-item-logo'>" + image +"</div>"+
            "<div class='board-item-detail'>"+ 
                '<span class="board-item-title">'+(item.title?item.title:item.stuff.title.substring(0,10))+'</span>'+
                "<div class='board-item-description'>"+(item.description?item.description.substring(0,20):"")+"</div>"+
            "</div>"+
        "</div>"+
    "</li>");

    num++;
    // 表示加载结束
    loading = false;
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
    if(tmpUser&&tmpUser.trim().length>0){//如果是临时用户进行记录。注意有时序关系，需要放在用户信息检查之前。
        shareUserId = tmpUser;
    }
    if(app.globalData.userInfo && app.globalData.userInfo._key){//如果为注册用户，则使用当前用户
        shareUserId = app.globalData.userInfo._key;
    }

    //准备分享url，需要增加分享的 fromUser、fromBroker信息
    var shareUrl = window.location.href.replace(/board2/g,"share");//需要使用中间页进行跳转
    if(shareUrl.indexOf("?")>0){//如果本身带有参数，则加入到尾部
        shareUrl += "&fromUser="+shareUserId;
        shareUrl += "&fromBroker="+shareBrokerId;
    }else{//否则作为第一个参数增加
        shareUrl += "?fromUser="+shareUserId;
        shareUrl += "&fromBroker="+shareBrokerId;        
    }
    shareUrl += "&origin=board";//添加源，表示是一个列表页分享

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
                    title:board&&board.title?board.title:"小确幸，大生活", // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg", // 分享图标
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
                    title:board&&board.title?board.title:"小确幸，大生活", // 分享标题
                    desc:board.description&&board.description.trim().length>0?board.description.replace(/<br\/>/g,""):"Live is all about having a good time.", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: "http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg", // 分享图标
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
