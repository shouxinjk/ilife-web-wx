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
    id = args["id"];//当前board id

    if(args["templateId"]){
        templateId = args["templateId"];//指定的显示模板ID。不传递则使用本地默认模板显示
        currentTemplate = args["templateId"];//指定的显示模板ID。不传递则使用本地默认模板显示
    }

    from = args["from"]?args["from"]:"mp";//可能为groupmessage,timeline等
    fromUser = args["fromUser"]?args["fromUser"]:"";//从连接中获取分享用户ID
    fromBroker = args["fromBroker"]?args["fromBroker"]:"";//从连接中获取分享达人ID。重要：将依据此进行收益计算
    boardType = args["type"]?args["type"]:"board2-waterfall";//从连接中获取清单类型，默认为waterfall
    $('#waterfall').NewWaterfall({
        width: columnWidth,
        delay: 100,
    });  

    //显示遮罩层
    showPostMask();

    //生成二维码：需要提前生成，避免时延导致显示不完整
    //generateQRcode();//在加载达人信息后显示，需要将达人ID写入URL

    //请求所有模板列表。请求完成后将触发生成
    requestViewTemplates();
    requestPosterScheme();//将同时装配显示到滑动条 
    //加载内容
    //loadBoard(id); 
    //加载清单item列表
    //loadBoardItems(id);
    //加载导航和关注列表
    loadCategories(category);      
});

var id=null;

util.getUserInfo();//从本地加载cookie

//使用代理避免跨域问题。后端将代理到指定的URL地址。注意：使用https
var imgPrefix = "https://www.biglistoflittlethings.com/3rdparty?url=";

//分享清单格式：board2、board2-waterfall
var boardType = "board2-waterfall";//默认为图片流
//viewTemplate id 根据指定模板显示海报。默认为null，将采用本地默认内容显示。本地显示同时作为新模板测试用途。
var templateId = null;

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
var board = {};//当前board

var boardItemTemplate = '<div class="board-item-wrapper">'+
                            '<div class="board-item-title">'+
                              '<span class="board-item-title-head">推荐__NUMBER</span>'+
                              '<span class="board-item-title-text">__TITLE</span>'+
                            '</div>'+   
                            '<div class="board-item-description">__DESCRIPTION</div>'+                                   
                        '</div>';


//加载海报模板列表：加载所有可用单品海报模板
var viewTemplates = {};//缓存所有模板，格式：id:{view template object}
function requestViewTemplates(){
    //获取模板列表
    $.ajax({
        url:app.config.sx_api+"/mod/viewTemplate/rest/listByType/board-poster",
        type:"get",
        data:{},
        success:function(schemes){
            console.log("\n===got item poster tempaltes ===\n",schemes);
            //遍历模板
            for(var i=0;i<schemes.length;i++){
                //将模板显示到界面，等待选择后生成
                if(!viewTemplates[schemes[i].id])
                    viewTemplates[schemes[i].id] = schemes[i];
            }
            showSwiper("template");
        },
         error: function(xhr, status, error){
             console.log("load item poster scheme error.",error);
         },
         complete:function(data){
            //加载商品并尝试生成海报：无论失败与否都要加载的
            //加载内容
            loadBoard(id); 
            //加载清单item列表
            loadBoardItems(id);            
         }
    });  
}

//获取海报列表
var posterSchemes = {};
function requestPosterScheme(){
    $.ajax({
        url:app.config.sx_api+"/mod/posterTemplate/rest/board-templates",
        type:"get",
        //data:{categoryId:stuff.meta.category},
        success:function(schemes){
            console.log("\n===got item poster scheme ===\n",schemes);
            //遍历海报模板
            for(var i=0;i<schemes.length;i++){
                if(!posterSchemes[schemes[i].id])
                    posterSchemes[schemes[i].id] = schemes[i];//记录poster定义
            }
            showSwiper("poster");
        }
    });  
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
    var longUrl = window.location.href.replace(/board2ext/g,boardType).replace(/fromBroker/g,"fromBrokerOrigin").replace(/fromUser/g,"fromUserOrigin");//获取分享目标链接
    longUrl = longUrl +"&jumpType=3rdparty";//添加跳转到第三方URL标志
    //添加分享达人及分享用户
    if(broker && broker.id)    
        longUrl += "&fromBroker="+broker.id;
    longUrl += "&fromUser="+(app.globalData.userInfo._key?app.globalData.userInfo._key:"");  
    
    //生成短码并保存
    var shortCode = generateShortCode(longUrl);
    console.log("got short code",shortCode);
    saveShortCode(hex_md5(longUrl),"board_"+id,fromBroker,fromUser,"mp",encodeURIComponent(longUrl),shortCode);    
    var shortUrl = "https://www.biglistoflittlethings.com/ilife-web-wx/s.html?s="+shortCode;//必须是全路径
    var logoUrl = imgPrefix+app.globalData.userInfo.avatarUrl;//需要中转，否则会有跨域问题

    //生成二维码
    var qrcode = new QRCode(document.getElementById("app-qrcode-box"), {
        text: shortUrl,
        width: 56,//96,
        height: 56,//96,    
        drawer: 'png',
        logo: logoUrl,
        logoWidth: 14,//24,
        logoHeight: 14,//24,
        logoBackgroundColor: '#ffffff',
        logoBackgroundTransparent: false
    });  
}

function buildDefaultPosterForTest(board){
    //动态计算海报宽度与高度
    var width = document.getElementsByTagName('html')[0].clientWidth;
    var height = width*9/16;//宽高比4:3    

    console.log("got poster height.",height);

    var minHeight = 340;//112*2 + 56 + 20 + 20;//计算一个最低高度

    //html模板：用于装载样式
    var templateHtml = `
        <div id="body" style="background-color:#fff;padding-left:0;width:100%;height:360px;">  
            <!--logo图片作为背景：是多张grid组合-->
            <div id="item-logo" style="width:100%;display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows: 1fr 1fr;grid-gap: 0px;">
                <div id="logo1" style="grid-area: 1 / 1 / 3 / 3;background-color:blue"></div>
                <div id="logo2" style="background-color:orange"></div>
                <div id="logo3" style="background-color:green"></div>
            </div>

            <div id="item-recommend" style="position:absolute;top:125px;left:3px;width:100%;">
                <!--顶部显示标题及ilife logo-->
                <div id="basic" style="display:flex;flex-direction:row;width:100%;">
                    <div id="item-title" style="background-color:#fff;color:grey;text-align:center;border-radius:20px;line-height:20px;margin-left:5px;padding:auto 5px;padding:2px 5px;width:calc(100% - 120px);border:1px solid silver;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" ></div> 
                    <div id="item-tip" style="background-color:#fff;color:grey;text-align:center;border-radius:20px;line-height:18px;margin-left:5px;padding:auto 5px;padding:2px 5px;margin-right:10px;width:112px;border:1px solid silver;" >@小确幸大生活</div> 
                </div>

                <!--中间显示评价规则及评价得分，其中评价得分采用barchart显示-->
                <div id="matrix" style="display:table;width:100%;">
                    <!--图表缺乏时填充空白，其高度等于图片高度--> 
                    <div id="matrix-placeholder" style="display:table-cell;width:50%;"></div> 
                </div>

                <!--底部显示推荐信息、评价logo、二维码-->
                <div id="sxRecommend" style="display:flex;flex-direction:row;flex-wrap:nowrap;">

                    <!--推荐者-->
                    <div id="broker" class="broker" style="width:calc(100% - 112px);margin:0;display:flex;">
                        <div id="broker-logo" class="broker-logo" style="border-radius:24px;"></div>
                        <div id="broker-shop" class="broker-shop">
                            <div id="broker-name" class="broker-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></div> 
                            <div id="shop-name" class="shop-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></div> 
                        </div>
                    </div> 

                    <!--评价LOGO，是静态图片-->
                    <div>
                        <img src="images/rate-logo.png" style="width:56px;margin-top:-2px;"/>
                    </div>      
                      
                    <div id="app-qrcode-box"></div>                 

                </div> 
            </div>

        </div>
    `;
    $("#container").html(templateHtml);
    $("#container").css("border-radius","0");
    //标题
    $("#item-title").html(board.title);          

    //使用类目作为推荐语
    var advice = "用小确幸填满大生活";
    if(board.tags) advice = board.tags;

    //$("#shop-name").html(item.category&&item.category.length>0?item.category[0]:""); //店铺名称   
    $("#shop-name").html(advice); //店铺名称   

    //设置div高度：需要动态计算
    var imgWidths = [2,1,1];
    var imgHeights = [2,1,1];
    var widthUnit = width/3;
    var heightUnit = height/2;

    var picHtml = `
            <img src="__src" style="object-fit:cover;/*width:__widthpx;height:__heightpx;*/width:100%;height:100%;"/>    
        `;

    //由于需要加载详情列表，此处需要有一个等待时间
    setTimeout(function(){
        //图片：将所有board图片放进图片列表内
        var  imgList  = [];
        if(board.logo) imgList.push(board.logo);
        //逐条放入item的图片：优先logo
        items.forEach(function(item){
            if(item.stuff&&item.stuff.logo&&imgList.indexOf(item.stuff.logo)<0)
                imgList.push(item.stuff.logo)
        });
        //逐条放入item的图片：images[0]
        items.forEach(function(item){
            if(item.stuff&&item.stuff.images&&imgList.indexOf(item.stuff.images[0])<0)
                imgList.push(item.stuff.images[0])
        });
        //逐条放入item的图片：images[1]
        items.forEach(function(item){
            if(item.stuff&&item.stuff.images&&item.stuff.images[1]&&imgList.indexOf(item.stuff.images[1])<0)
                imgList.push(item.stuff.images[1])
        });        


        //将图片放入grid
        for(var i=0;i<3 && i<imgList.length;i++){
            var imgUrl = imgPrefix + imgList[i].replace(/\.avif/,'');
            $("#logo"+(i+1)).append(picHtml.replace(/__src/,imgUrl).replace(/__width/,imgWidths[i]*widthUnit).replace(/__height/,imgHeights[i]*heightUnit));//正文图片
            //需要通过父级div元素完成图片自适应
            $("#logo"+(i+1)).css({
                height:imgHeights[i]*heightUnit,
                width:imgWidths[i]*widthUnit
            });
            preloadList.push(imgUrl);//将图片加入预加载列表
        }

        var matrixMargin = $("#item-logo").height() - 26 -2;//采用固定高度，去掉顶部标题行均为图表显示区域
        $("#matrix-placeholder").css({
            "height":matrixMargin+"px",
        }); 

        //计算整个海报高度：由于图片高度不固定，需要根据图片高度实际计算
        //海报高度 = 图片高度+56；其中图片高度由logo缩放得到，56为底部推荐条高度；海报最低高度340
        var posterHeight = $("#item-logo").height() + 56;
        $("#body").css({
            "height":posterHeight+"px",
        });        

        //logo：注意使用代理避免跨域问题
        preloadList.push(imgPrefix+app.globalData.userInfo.avatarUrl);//将图片加入预加载列表
        $("#broker-logo").html("<img src='"+imgPrefix+app.globalData.userInfo.avatarUrl+"'/>");        
    },1200);
}

function buildDefaultPoster(board){
    //动态计算海报宽度与高度
    var width = document.getElementsByTagName('html')[0].clientWidth;
    var height = width*9/16;//宽高比4:3
    //html模板：用于装载样式
    var templateHtml = `
        <div id="body" style="background-color:#fff;padding-left:0;width:100%;padding-top:0;">  
            <div id="item-logo" style="width:100%;position:relative;">
                <img src="" style="object-fit:cover;width:100%;height:__heightpx;">
                <div id="item-platform" style="position:absolute;top:5px;right:5px;font-size:12px;font-weight:bold;color:#fff;border-radius:12px;background-color:#F6824B;padding:2px 5px;"></div>
                <div id="item-title" style="position:absolute;top:__top1px;left:0;right:0;bottom:0;margin:auto;font-size:20px;font-weight:bold;width:80%;display:inline-block;white-space: nowrap; overflow:hidden;text-overflow:ellipsis;text-align:center;color:#fff;"></div> 
                <div id="item-advice" style="position:absolute;top:__top2px;left:0;right:0;bottom:0;margin:auto;font-size:16px;font-weight:bold;width:90%;display:inline-block;white-space: nowrap; overflow:hidden;text-overflow:ellipsis;text-align:center;color:#fff;"></div>  
            </div>  
             
                                
        </div>

        <div style="display:table;margin-left:-2px;margin-top:-2px;" id="smallpics"> 
            <!--评价LOGO，是静态图片-->
            <div style="display:table-cell;">
                <img src="images/rate-logo.png" style="width:52px;"/>
            </div>  

            <!--二维码-->        
            <div id="app-qrcode-box" style="width:56px;display:table-cell;"></div>  
        </div>  
    `;
    $("#container").html(templateHtml.replace(/__height/,height).replace(/__top1/,(height/2-15)).replace(/__top2/,(height/2+15)));
    $("#container").css("background","#fff");
    //标题
    $("#item-title").html(board.title);
    //标题
    $("#item-advice").html(board.tags);    
    //平台
    $("#item-platform").html(app.globalData.userInfo.nickname);//默认显示推荐者昵称

    //由于需要加载详情列表，此处需要有一个等待时间
    setTimeout(function(){
        //图片
        var boardLogo = "";
        if(board.logo){
            boardLogo = board.logo;//正文图片
        }else{//默认随机从列表内容中选一张
            var randomIndex = new Date().getTime() % items.length;
            var stuff = items[randomIndex].stuff;
            if(stuff.logo){
                boardLogo = stuff.logo;//使用logo
            }else{
                boardLogo = stuff.images[0];//从图片列表内获取
            }
        }
        $("#item-logo img").attr("src", imgPrefix+ boardLogo.replace(/\.avif/,''));//正文图片

        var picHtml = `
                <div class="app-qrcode" style="display:table-cell;border-right:2px solid #fff;">
                    <img src="__src" style="object-fit:cover;width:__widthpx;height:__heightpx"/> 
                </div>    
            `;

        var smallPicWidth = (width-8-112)/4;//二维码为98*98，中间留白为4
        var smallPicHeight = smallPicWidth>49?49:smallPicWidth;
        //填充小图片：默认采用固定大小，并优先用默认图片填充
        var k=0;//仅取3张
        for(var i=0;i<4&&k<3&&items.length>3;i++){//需要items长度超过3
            var imgUrl = imgPrefix + "";//默认图片
            var itemLogo = items[i].stuff.logo;
            if(!itemLogo) itemLogo = items[i].stuff.images[0];
            if(itemLogo != boardLogo ){
                imgUrl = imgPrefix + itemLogo.replace(/\.avif/,'');
            }else{
                continue;
            }
            $("#smallpics").prepend(picHtml.replace(/__src/,imgUrl).replace(/__width/,smallPicWidth).replace(/__height/,smallPicHeight));
            preloadList.push(imgUrl);//将图片加入预加载列表
            k++;
        }

        //将用户logo作为首图
        $("#smallpics").prepend(picHtml.replace(/__src/,imgPrefix+app.globalData.userInfo.avatarUrl).replace(/__width/,smallPicWidth).replace(/__height/,smallPicHeight));

        //logo：注意使用代理避免跨域问题
        preloadList.push(imgPrefix+app.globalData.userInfo.avatarUrl);//将图片加入预加载列表
        $("#broker-logo").html("<img src='"+imgPrefix+app.globalData.userInfo.avatarUrl+"'/>");        
    },1200);

}

//将board内容显示到页面
function showContent(board){
    console.log("try to show content.[template id]",currentTemplate);
    //将描述作为推荐语
    //显示推荐语：
    if(board.description && board.description.trim().length>0){
        $("#advicesDiv").append("<div id='adviceEntry' style='line-height:18px;width:90%;border-top:1px solid silver;font-size:12px;padding-top:10px; padding-bottom:10px;' data-clipboard-text='"+board.description+"'>"+board.description+"</div>");
        var clipboard = new ClipboardJS('#adviceEntry');
        clipboard.on('success', function(e) {
            //$('#jumpbtn').attr('data-clipboard-text',item.link.token);
            //console.info('Action:', e.action);
            console.info('advice copied:', e.text);
            siiimpleToast.message('推荐语已复制~~',{
                  position: 'bottom|center'
                }); 
        });            
    }else{
        $("#advicesTitleDiv").css("display","none");
    }

    //判断是否指定模板ID
    if(templateId && currentTemplate && currentTemplate.trim().length>0){//如果指定了显示模板则根据显示模板装配内容
        //直接eval显示模板
        try{
            console.log("try to eval template expression.",viewTemplates[currentTemplate]);
            eval(viewTemplates[currentTemplate].expression);//注意：直接eval
        }catch(err){
            console.log("eval poster expression error.",err);
            //显示提示浮框
            siiimpleToast.message('参数错误，将生成默认海报~~',{
                  position: 'bottom|center'
                });             
            buildDefaultPoster(board);//这里出错了就只能拿本地的来垫背了
        }        
    }else{//否则装配本地默认内容
        console.log("ignore poster template. generate default poster.",currentTemplate);
        buildDefaultPoster(board)
    }

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

/////////////////////////////////////////////////////////////////////////////////////////
//以下用于优化海报生成。当前promise.finally不支持，不能工作

Promise.prototype.finally = callback => {
    return this.then(
        value => this.constructor.resolve(callback()).then(() => value),
        reason => this.constructor.resolve(callback()).then(() => { throw reason })
    )
}

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
    var scale = 3;//DPR(); //定义任意放大倍数 支持小数:【注意在css中需要对目标元素设置 transform: 1/scale】
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
        if (res.status) {//将佣金信息显示到页面
            broker = res.data;
            $("#author").html(broker.nickname);    //如果当前用户是达人，则转为其个人board
            $("#broker-name").html(broker.nickname+ " 推荐");    //如果当前用户是达人，则显示当前用户
            //所属机构：注意模板中必须包含 item-tip，否则无效
            if(broker&&broker.orgnization&&broker.orgnization.name){
                $("#item-tip").html("@"+broker.orgnization.name);
            }              
            //生成达人推广二维码
            generateQrcode();
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
        var hits = res&&res.length>5?res.slice(0,5):res;//如果大于5则仅取5条
        totalItems = hits.length;
        console.log("Board::loadBoardItems prepare post items.", hits)
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

            //准备生成海报：
            //将图片加入到预加载列表内：
            preloadList.push(imgPrefix+item.stuff.images[0].replace(/\.avif/,''));
            if(items.length >= totalItems){//加载完成后生成海报，默认提前限制加载条数
                console.log("start generate post.[num,total]",items.length,totalItems);
                window.setTimeout(generateImage,2000);//需要等待图片加载完成
                return;
            }else{
                console.log("rendering items.[num,total]",items.length,totalItems);
            }

        }
    })            
}

//将item显示到页面。每一个item提供推荐标题、推荐描述编辑。并展示对应的itemlogo、来源、原始标题及tag
function insertBoardItem(){
    // 加载内容
    var item = items[num-1];
    if(!item)return;

    //显示推荐语：
    /**
    if(item.description && item.description.trim().length>0){
        $("#advicesDiv").append("<div style='line-height:18px;line-height:18px;width:90%;border-top:1px solid silver;font-size:12px;padding-top:10px; padding-bottom:10px;'>"+item.description+"</div>");
    }
    //**/

    var logoImg = "images/tasks/board.png";
    if(item.stuff && item.stuff.images && item.stuff.images.length>0){
        //logoImg = item.stuff.images[0];//默认用第一张图片做logo
        logoImg = imgPrefix+item.stuff.images[0].replace(/\.avif/,'');//对第三方图片使用代理，避免跨域问题
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
    var taggingList = item.stuff.tagging?item.stuff.tagging.split(" "):[];
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
                '<div class="board-item-title">'+(item.title?item.title:item.stuff.title)+'</div>'+
                "<div class='board-item-description'>"+(item.description?item.description:"")+"</div>"+
            "</div>"+
        "</div>"+
    "</li>");

    num++;
    // 表示加载结束
    loading = false;
}

function loadCategories(currentCategory){
    $.ajax({
        url:app.config.sx_api+"/mod/channel/rest/channels/active",
        type:"get",
        success:function(msg){
            var navObj = $(".navUl");
            for(var i = 0 ; i < msg.length ; i++){
                navObj.append("<li data='"+msg[i].id+"' style='line-height:40px;font-size:12px;font-weight:bold;'>"+msg[i].name+"</li>");
                if(currentCategory == msg[i].id)//高亮显示当前选中的category
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

//装载模板选择滑动条
var currentTemplate = null;
var hasTemplates = false;
var hasPosters = false;
function showSwiper(type){
    if(type=="template")hasTemplates=true;
    if(type=="poster")hasPosters=true;

    //必须template及poster均已加载才装配
    if(!hasTemplates || !hasPosters)
        return;

    //将viewTemplate装载到页面
    for (var key in viewTemplates) {
        if($("#"+key).length == 0)
            insertTemplate(viewTemplates[key],"template");
    }  
    //将posterScheme装载到页面  
    for (var key in posterSchemes) {
        if($("#"+key).length == 0)
            insertTemplate(posterSchemes[key],"poster");
    }      
  
    //显示滑动条
    var mySwiper = new Swiper ('.swiper-container', {
        //slidesPerView: 4,
        slidesPerView: from=="web"?parseInt(document.getElementsByTagName('html')[0].clientWidth/100):5,
    });  
    //调整swiper 风格，使之悬浮显示
    $(".swiper-container").css("position","relative");
    $(".swiper-container").css("left","0");
    $(".swiper-container").css("top","40");
    $(".swiper-container").css("z-index","999");
    $(".swiper-container").css("background-color","#f6d0ca");
    //$(".swiper-container").css("margin-bottom","3px");
  
    //将当前用户设为高亮  
    if(templateId && templateId.trim().length>0){
        currentTemplate = templateId;
    }else{//根据当前用户加载数据：默认使用第一个：注意由于viewTemplates为object，需要根据第一个键值获取
        currentTemplate = viewTemplates[Object.keys(viewTemplates)[0]].id; 
    }   
    //把当前选中的高亮  
    highlightTemplate(currentTemplate);      
}

//将viewTemplate及psoterScheme显示到滑动条
//注意默认认为两者都拥有id及logo字段，并在装载时指定type
function insertTemplate(item,type){
    console.log("insert template.",type,item);
    // 获取logo
    var logo = "http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(11)+".jpeg";
    if(item.logo)
        logo = item.logo;
    // 显示HTML
    var html = '';
    html += '<div class="swiper-slide">';
    html += '<div id="'+item.id+'" data-type="'+type+'" style="border:1px solid siver;border-radius:5px;vertical-align:middle;padding:3px 0;">';
    var style= item.id==currentTemplate?'border:2px solid #e16531':'border:2px solid #f6d0ca';
    html += '<img style="object-fit:cover;border-radius:10px;'+style+'" src="'+logo+'" width="68" height="68"/>';
    html += '</div>';
    $("#tempaltes").append(html);

    //注册事件:点击后切换
    $("#"+item.id).click(function(e){
        console.log("try to change template.",e.currentTarget.id,$(this).data("type"));
        if(e.currentTarget.id == currentTemplate){//点击当前选中模板，啥也不干
            //do nothing
        }else{//否则，高亮显示选中的模板
            changeTemplate(e.currentTarget.id,$(this).data("type"));
        }
    });
}

//切换海报模板
function changeTemplate (templateId,type) {
    var ids = templateId;
    if (app.globalData.isDebug) console.log("Feed::ChangePerson change person.",currentTemplate,templateId);
    $("#"+currentTemplate+" img").css("border","2px solid #e16531");
    $("#"+ids+" img").css("border","2px solid #f6d0ca");

    //TODO 重新生成海报
    if(type=="template"){//如果是viewTemplate则直接重新生成
        var targetUrl = window.location.href;
        if(targetUrl.indexOf("templateId")>0){
            targetUrl = window.location.href.replace(currentTemplate,templateId);//直接跳转
        }else if(targetUrl.indexOf("?")>0){
            targetUrl = window.location.href+"&templateId="+templateId;//直接跳转
        }else{//啥玩意，这种情况不会出现，至少会有一个id参数
            targetUrl = window.location.href+"?templateId="+templateId;//直接跳转
        }
        window.location.href = targetUrl;
        //当前页面内生成有问题，直接采用跳转的方式生成
        /**
        currentTemplate = templateId;
        $("#container").empty();//清空海报容器及内容
        $("#share-img").empty();//清空已经生成的图片
        //$("#post-mask").toggleClass("post-mask-hide",false);  
        showPostMask();
        preloadList.push(imgPrefix+stuff.images[0].replace(/\.avif/,''));
        showContent(stuff);
        //loadBrokerByOpenid(app.globalData.userInfo._key);
        generateQrcode(); //重新生成二维码
        //**/
    }else{//否则跳转到后台海报生成界面
        var targetUrl = window.location.href.replace(/board2ext/,"board2-poster").replace(/templateId/,"posterId").replace(currentTemplate,templateId);
        if(targetUrl.indexOf("posterId")>0){
            targetUrl = targetUrl.replace(currentTemplate,templateId);//直接跳转：实际不会生效
        }else if(targetUrl.indexOf("?")>0){
            targetUrl = targetUrl+"&posterId="+templateId;//直接跳转
        }else{//啥玩意，这种情况不会出现，至少会有一个id参数
            targetUrl = targetUrl+"?posterId="+templateId;//直接跳转
        }
        window.location.href=targetUrl;
    }
} 

//仅高亮模板标记，不重新加载数据
function highlightTemplate (templateId) {
    var ids = templateId;
    if (app.globalData.isDebug) console.log("Index::highlightPerson highlight person.",currentTemplate);
    $("#"+currentTemplate+" img").css("border","2px solid #f6d0ca");
    $("#"+ids+" img").css("border","2px solid #e16531");
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
                    imgUrl:board.logo?board.logo:"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg", // 分享图标
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
                    imgUrl: board.logo?board.logo:"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg", // 分享图标
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
