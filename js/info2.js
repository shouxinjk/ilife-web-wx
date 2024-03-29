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

    //检查设置首次触达达人
    if(fromBroker && fromBroker.trim().length>0){
        util.checkInitBroker(fromBroker);
    }

    posterId = args["posterId"]?args["posterId"]:null;//从连接中获取海报ID，默认为空。如果没有则跳转到默认海报生成


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

    //加载用户行为标签，用户能够主动发起标注
    loadUserActionTags();

    //显示tabs
    $( "#tabs" ).tabs();

    //注册点击事件：加入选品库
    $("#addSelectionBtn").click(function(){
        //加入选品库：即记录选品事件，后续直接从log中查询
        logstash(stuff,from,"selection",app.globalData.userInfo._key,broker.id,function(){
            console.log("add item to my selection.");
            siiimpleToast.message('已加入选品库',{
              position: 'bottom|center'
            }); 
        });          
        //推送到CK，同步发送到微信群：当前禁用。需要进入选品库手动推送
        /**
        wxGroups.forEach(function(wxgroup){
            if(wxgroup.name == 'sx临时群') //for test
            saveFeaturedItem(getUUID(), broker.id, "wechat", wxgroup.id, wxgroup.name, "item", stuff._key, JSON.stringify(stuff), "pending");
        });   
        if(wxGroups.length>0){
            console.log("wxgroups synchronized.");
            siiimpleToast.message('推送已安排~~',{
              position: 'bottom|center'
            });             
        }  
        //**/  
    });    
    //注册点击事件：查看选品库
    $("#goSelectionBtn").click(function(){
        window.location.href="broker/selection.html";           
    });  

    //注册点击事件：补充数据：点击补充数据后显示可编辑表单。包含继承属性数据
    $("#addDataBtn").click(function(){
        $("#propsview").css("display","none"); //隐藏只读列表 
        $("#props").css("display","block"); //显示编辑表单      
    });      

    //注册点击事件：赞同评价规则
    $(".likeDimensionBtn").click(function(){
        //记录赞同事件
        logstash(stuff,from,"like",app.globalData.userInfo._key,broker.id,function(){
            console.log("like measure.");
            siiimpleToast.message('已提交',{
              position: 'bottom|center'
            }); 
        });           
    });        
    //注册点击事件：不赞同评价规则
    $(".unlikeDimensionBtn").click(function(){
        //记录赞同事件
        logstash(stuff,from,"unlike",app.globalData.userInfo._key,broker.id,function(){
            console.log("like measure.");
            siiimpleToast.message('已提交',{
              position: 'bottom|center'
            }); 
        });           
    });

    //判定显示底部菜单
    showSxMenu();    

    require.config({
      baseUrl: 'ext/d3',
      map: {
        '*': {
          'd3-path.js': 'd3-path',
          'd3-array.js': 'd3-array',
          'd3-shape.js': 'd3-shape',
        }
      }
    });
    require(['d3-path','d3-array','d3-shape','d3-sankey'], function (d3Path,d3Array,d3Shape,_d3Sankey) {
        d3Sankey = _d3Sankey;
        console.log("load module d3Sankey. ",d3Sankey);
    });

});

var d3Sankey = null;

util.getUserInfo();//从本地加载cookie
util.getBrokerInfo();//从本地加载bookie

var columnWidth = 300;//默认宽度300px
var columnMargin = 5;//默认留白5px

var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var items = [];//用户行为列表
var page = {//翻页控制
  size: 20,//每页条数
  total: 1,//总页数
  current: -1//当前翻页
};

var totalActions = 0;//记录用户行为总数
var actionTypes = {
  view:"看了",
  share:"分享",
  "publish":"分享",
  "collect":"发现",  
  "share poster":"分享海报",
  "share board poster":"打包分享",
  "share appmsg":"分享给好友",
  "share timeline":"分享到朋友圈",
  "buy step1":"很感兴趣",
  "buy step2":"拔草",
  buy:"拔草",
  label:"标注",
  favorite:"种草",
  like:"喜欢"
};

//统计用户行为数量
var actionCounts = {
  view:0,
  share:0,
  buy:0,
  favorite:0,//前端采集
  like:0,
  rank:0
};

//用户行为转换：将不同种类分享合并为同一个行为
var actionTypeConvert = {
  view:"view",
  label:"view",
  share:"share",
  "publish":"share",
  "collect":"view",  
  "share poster":"share",
  "share board poster":"share",
  "share appmsg":"share",
  "share timeline":"share",
  "buy step1":"buy",
  "buy step2":"buy",
  buy:"buy",
  favorite:"like",
  like:"like",
  rank:"rank"
};

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

var posterId = null;//海报scheme

//支持的类目
var sxCategories = [];
var cascader = null;//级联选择器实例

var currentPerson = app.globalData.userInfo;

var _sxdebug = true;

//评价指标列表
var measureScheme = [];//每一项包含name weight children

//将item显示到页面
function showContent(item){
    //如果带有海报则直接跳到海报分享界面
    if(posterId){
        $("#share-link").attr("href","info2-poster.html?id="+id+"&posterId="+posterId);   
    }else{
       $("#share-link").attr("href","info2ext.html?id="+id);    
    }

    //购买按钮
    if(item.distributor && item.distributor.name)
        $("#jumpbtn").text("立即前往 "+item.distributor.name+" >> ");
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
        $("#gallery").append("<li><img src='" + item.images[i].replace(/\.avif/,'') + "' alt=''/></li>");//加载图片幻灯
        $("#content").append("<img src='" + item.images[i].replace(/\.avif/,'') + "' width='100%'/>");//正文图片
    }
    //加入media图片
    if(item.media && Object.keys(item.media) && Object.keys(item.media).length>0){
        Object.keys(item.media).forEach(function(key){
            if(key!="measure2"){
                //$("#gallery").append("<li><img src='" + item.media[key]+ "' alt=''/></li>");//加载图片幻灯
                $("#content").append("<img src='" + item.media[key]+ "' width='100%'/>");//正文图片                   
            }
        });
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
        //显示淘口令便于直接复制
        $("#link").append('<div class="link-token">'+tokenStr+'</div>');
    }

    //标签
    /**
    if(item.distributor && item.distributor.name){//来源作为标签
        $("#tags").append("<div class='tag'>"+item.distributor.name+"</div>");
    }   
    //**/ 
    for(var i=0;item.tags&&i<item.tags.length;i++){//标签云
        if(item.tags[i].trim().length>0)
            $("#tags").append("<div class='tag'>" + item.tags[i] + "</div>");//加载图片幻灯
    }

    //数说：显示生成的评价结果图
    var categoryProps = {};//默认为空，仅在设置了categoryId才调用
    if(item.meta && item.meta.category){
        //会生成评价结果图表，隐藏类目选择器
        $("#category-wrapper").css("display","none");
        /**
        //抛弃：改同步调用为异步调用
        //加载类目属性定义
        categoryProps = loadCategoryProperties(item.meta.category,false);//注意是同步调用
        adviceSchemes = requestAdviceScheme(item.meta.category,false);//注意是同步调用。获取推荐语模板列表，用于显示。返回后存储于adviceSchemes
        //加载客观评价
        loadMeasureAndScore();//加载客观评价
        //**/        
        loadProps(item.meta.category);//加载属性列表，并支持补充及修订
        loadCategoryProperties(item.meta.category);//异步调用
        requestAdviceScheme(item.meta.category);//异步调用
    }else if((broker && broker.id)||(app.globalData.brokerInfo && app.globalData.brokerInfo.id)){//对于broker开放修改category
        //表示没有类目，提示选择类目完成标注
        $("#category-wrapper-tip").css("display","block");
        loadSxCategories();
    }else{
        //显示提示信息
        //$("#tabs-data").html("<div class='prop-value'>尚未完成评价，请稍等……</div>");   
        //当前开放所有人能够标注
        $("#category-wrapper-tip").css("display","block");
        loadSxCategories();             
    }
    //显示已经生成的海报：仅显示客观评价海报
    var showPoster = false;
    if(showPoster && item.poster){
        var total = 0;
        for(j in item.poster){
            var posterUrl = item.poster[j];
            $("#poster").append("<div class='prop-row'><img style='object-fill:cover;width:100%' src='"+posterUrl+"'/></div>");
            total ++;
        }
        if(total>0)
            $("#posterTitle").css("display","block");
    }




    //卖家说：平台logo
    //$("#platform-logo").append("<img src='"+app.config.res_api+"/logo/distributor/"+item.source+".png' alt='"+item.distributor.name+"'/>");
    var totalprops = 0;
    if(item.props && Array.isArray(item.props)){//兼容数组结构
        item.props.forEach(function(json){
            for (var key in json){
                $("#propsview").append("<div class='prop-row'><div class='prop-key' style='text-align:right'>"+(categoryProps[key]?categoryProps[key]:key)+"</div><div class='prop-value' style='padding-left:5px;'>"+json[key]+"</div></div>");
                totalprops ++;
            }            
        });
    }else{//键值对则直接遍历
        for (var key in item.props){
            if(item.props[key])
                $("#propsview").append("<div class='prop-row'><div class='prop-key' style='text-align:right'>"+(categoryProps[key]?categoryProps[key]:key)+"</div><div class='prop-value' style='padding-left:5px;'>"+item.props[key]+"</div></div>");
                totalprops++;
        } 
    }
    if(totalprops>0){
        $("#propsTitle").css("display","block");  
    }

    //买家说：评价
    if(item.rank && item.rank.score){
        $("#rank").append("<div class='prop-row'><div class='prop-key'>用户评分</div><div class='prop-value item-score'></div></div>");
        $(".item-score").starRating({
            readOnly:true,
            starSize: 15,
            initialRating: item.rank.score,
            ratedColors:['#8b0000', '#dc143c', '#ff4500', '#ff6347', '#1e90ff','#00ffff','#40e0d0','#9acd32','#32cd32','#228b22'],
            callback: function(currentRating, $el){
                // make a server call here
            }
        });
    }
    if(item.rank && item.rank.count){
        updateActionCount("rank",item.rank.count);
        //$("#rank").append("<div class='prop-row'><div class='prop-key'>打分人数</div><div class='prop-value'>"+item.rank.count+"</div></div>");
    }

    //推荐语
    var myAdvice = "";//我的推荐语
    if(item.advice){
        for(key in item.advice){
            if(key == app.globalData.userInfo._key){//如果该推荐语是当前用户提供的，则显示编辑框，可以修改
                myAdvice = item.advice[key];
            }else if(item.advice[key].indexOf(":::")>0){//如果是达人推荐语，其结构为 达人昵称:::推荐语
                var brokerAdvice = item.advice[key].split(":::");
                
                var adviceIdx = key;
                var adviceTxt = brokerAdvice[1];
                $("#advice").append("<div class='prop-row'><div class='prop-key'>"+brokerAdvice[0]+"</div><div class='prop-value' id='adviceEntry"+adviceIdx+"' data-clipboard-text='"+adviceTxt+"'>"+brokerAdvice[1]+"</div></div>");
                var clipboard = new ClipboardJS('#adviceEntry'+adviceIdx);
                clipboard.on('success', function(e) {
                    console.info('advice copied:', e.text);
                    siiimpleToast.message('推荐语已复制~~',{
                          position: 'bottom|center'
                        }); 
                }); 

            }else{//否则显示只读
                var adviceIdx = key;
                var adviceTxt = item.advice[key];
                $("#advice").append("<div class='prop-row'><div class='prop-key'>"+(adviceSchemes[key]?adviceSchemes[key]:"生活家说")+"</div><div class='prop-value' id='adviceEntry"+adviceIdx+"' data-clipboard-text='"+adviceTxt+"'>"+item.advice[key]+"</div></div>");
                var clipboard = new ClipboardJS('#adviceEntry'+adviceIdx);
                clipboard.on('success', function(e) {
                    console.info('advice copied:', e.text);
                    siiimpleToast.message('推荐语已复制~~',{
                          position: 'bottom|center'
                        }); 
                });                 
            }
        }
    }  
    //如果是达人，则显示推荐语编辑框，默认为已经有的推荐语
    console.log("show broker advice ...",broker);
    if((broker && broker.id)||(app.globalData.brokerInfo && app.globalData.brokerInfo.id)){
        console.log("show broker advice ...");
        var brokerAdvice = myAdvice.split(":::");
        $("#advice").append("<div class='prop-row'><div class='prop-key'>我的推荐</div><div class='prop-value'><textarea id='myAdvice' rows='5' style='width:100%;border:1px solid silver;padding:2px; line-height:16px;'>"+brokerAdvice[brokerAdvice.length-1]+'</textarea><button type="submit" class="btn btn-default" id="submitBtn" style="padding-left: 10px;padding-right:10px;">推荐</button> </div></div>');
        $("#submitBtn").click(function(){//提交修改
            var myAdvice = $("#myAdvice").val();
            if(myAdvice && myAdvice.trim().length>0){
                if (!item.adivce)item.advice={};
                item.advice[app.globalData.userInfo._key] = app.globalData.userInfo.nickName + ":::"+myAdvice;
                submitItemForm();
            }
        });
    }      

    //用户行为列表
    for (var actionType in actionTypes){//注意：这里需要发起多次搜索，可能导致性能问题
        loadCountByAction(actionType);
    } 
    if(item.tagging && item.tagging.length>0){
        var usertags = "";
        item.tagging.trim().split(" ").forEach(function(tagItem){
            usertags += "<div class='tag'>"+tagItem+"</div>";
        });
        $("#rank").append("<div class='prop-row'><div class='prop-key'>用户标签</div><div class='prop-value tags'>"+usertags+"</div></div>");
    }
    //加载用户行为：注意，需要到等到stuff加载后才开始
    showloading(true);
    loadFeeds();    
    
    //TODO：添加主题及推荐信息
        

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

function showSelectionBtns(){
    //显示加入选品按钮
    $("#addSelectionBtn").css("display","inline");    
    $("#goSelectionBtn").css("display","inline");
    $("#jumpbtn").css("width","45%");
}


//根据达人ID加载活跃微信群
var wxGroups = [];//存储当前达人的微信群列表
function loadWxGroups(brokerId){
    console.log("try to load wx groups by brokerId.",brokerId);
    $.ajax({
        url:app.config.sx_api+"/wx/wxGroup/rest/listByBrokerId?brokerId="+brokerId,
        type:"get",        
        success:function(ret){
            console.log("===got wx groups===\n",ret);
            wxGroups = ret;
        }
    }); 
}
//存储featured item到ck
function saveFeaturedItem(eventId, brokerId, groupType, groupId, groupName,itemType, itemKey, jsonStr, status){
  var q = "insert into ilife.features values ('"+eventId+"','"+brokerId+"','"+groupType+"','"+groupId+"','"+groupName+"','"+itemType+"','"+itemKey+"','"+jsonStr.replace(/'/g, "’")+"','"+status+"',now())";
  console.log("try to save featured item.",q);
  jQuery.ajax({
    url:app.config.analyze_api+"?query=",//+encodeURIComponent(q),
    type:"post",
    data:q,
    headers:{
        "content-type": "text/plain; charset=utf-8", // 直接提交raw数据
        "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
    },         
    success:function(json){
      console.log("===featured item saved.===\n",json);
    }
  });    
}

//加载类目数据，加载完成后显示级联选择器
function loadSxCategories(){
    $.ajax({
        url:"https://data.shouxinjk.net/ilife/a/mod/itemCategory/all-categories?parentId=1",
        type:"get",
        success:function(res){
            //装载categories
            if(_sxdebug)console.log("got all categories",res);
            sxCategories = res;  
            //显示级联选择
            showCascader(null);
        }
    })    
}

//根据ID获取类目下定义的属性列表
var categoryProps = {};//存储类目属性id:name键值对
function loadCategoryProperties(categoryId/*, isAnsync=true*/){
    //var categoryProps = {};//存储类目属性id:name键值对
    //根据categoryId获取所有measure清单，字段包括name、property
    $.ajax({
        url:"https://data.shouxinjk.net/ilife/a/mod/measure/measures?category="+categoryId,
        type:"get",
        //async:isAnsync,
        data:{},
        success:function(items){
            if(_sxdebug)console.log(items);
            for( k in items ){
                var item = items[k];
                if(_sxdebug)console.log("measure:"+JSON.stringify(item));
                var name=item.name;
                var property = item.property;
                categoryProps[property]=name;
            }
            hasCategoryProps = true;//更新数据获取状态
            loadMeasureAndScore();//加载并显示

        }
    });
    //return categoryProps;
}

//获取推荐语模板列表，用于展示使用。
var adviceSchemes = {};//显示id：name键值对
function requestAdviceScheme(categoryId/*,isAnsync*/){
    //var adviceSchemes = {};//显示id：name键值对
    //获取模板列表
    $.ajax({
        url:app.config.sx_api+"/mod/template/rest/item-templates",
        type:"get",
        //async:isAnsync,
        data:{categoryId:categoryId,status:"active"},//仅选取已启用推荐语
        success:function(schemes){
            console.log("\n===got item advice schemes ===\n",schemes);
            //遍历并生成文案
            for(var i=0;i<schemes.length;i++){
                adviceSchemes[schemes[i].id]=schemes[i].name;
                requestAdvice(schemes[i]);
            }
            hasAdviceSchemes = true;//记录数据获取状态
            loadMeasureAndScore();//加载并显示
        }
    }); 
    //return  adviceSchemes;
}


//生成文案：根据文案模板直接生成。注意需要与已经存储在item上的推荐语排重
function requestAdvice(scheme){
    //判断海报模板是否匹配当前条目
    var isOk = false;
    if(scheme.condition && scheme.condition.length>0){//如果设置了适用条件则进行判断
        try{
            isOk = eval(scheme.condition);
        }catch(err){
            console.log("\n=== eval poster condition error===\n",err);
        }
    }else{//如果未设置条件则表示适用于所有商品
        isOk = true;
    }
    if(!isOk){//如果不满足则直接跳过
        console.log("condition not satisifed. ignore.");
        return;       
    }

    //检查是否已经生成，如果已经生成则不在重新生成
    if(stuff.advice && stuff.advice[scheme.id]){
        console.log("\n=== advice exists. ignore.===\n");
        return;
    }

    //生成文案
    try{
        eval(scheme.expression);//注意：脚本中必须使用 var xAdvice=**定义结果
    }catch(err){
        return;//这里出错了就别玩了
    }
    //将文案显示到界面
    var adviceIdx = scheme.id;
    var adviceTxt = xAdvice;
    $("#advice").prepend("<div class='prop-row'><div class='prop-key'>确幸推荐</div><div class='prop-value' id='adviceEntry"+adviceIdx+"' data-clipboard-text='"+adviceTxt+"'>"+adviceTxt+"</div></div>");
    var clipboard = new ClipboardJS('#adviceEntry'+adviceIdx);
    clipboard.on('success', function(e) {
        console.info('advice copied:', e.text);
        siiimpleToast.message('推荐语已复制~~',{
              position: 'bottom|center'
            }); 
    }); 
}

//注意：在cascade中引用Array.flat()方法，但微信浏览器未实现，需要补充
Object.defineProperty(Array.prototype, 'flat', {
    value: function(depth = 1) {
      return this.reduce(function (flat, toFlatten) {
        return flat.concat((Array.isArray(toFlatten) && (depth>1)) ? toFlatten.flat(depth-1) : toFlatten);
      }, []);
    }
});

//显示级联选择器
function showCascader(categoryId){
    cascader = new eo_cascader(sxCategories, {
        elementID: 'category-wrapper',
        multiple: false, // 是否多选
        // 非编辑页，checkedValue 传入 null
        // 编辑时 checkedValue 传入最后一级的 ID 即可
        checkedValue: categoryId?[categoryId] : null,
        separator: '/', // 分割符 山西-太原-小店区 || 山西/太原/小店区
        clearable: false, // 是否可一键删除已选
        onSelect:function(selectedCategory){//回调函数，参数带有选中标签的ID和label。回传为：{id:[],label:[]}//其中id为最末级选中节点，label为所有层级标签
            if(_sxdebug)console.log("crawler::category item selected.",selectedCategory);
            //更新当前item的category。注意更新到meta.category下
            stuff.meta = {category:selectedCategory.id[0],categoryName:selectedCategory.label[selectedCategory.label.length-1]};//仅保存叶子节点
            stuff.status.classify = "ready";
            stuff.status.load = "pending";
            stuff.timestamp.classify = new Date();
            //更新类目映射：修改后直接提交修改
            changeCategoryMapping();  
            //加载属性值列表
            loadProps(selectedCategory.id[0]);
            //提交类目
            submitItemForm();
            //重新生成图表
            showRadar();
            showSankey();
            showDimensionBurst();
            showDimensionMondrian();
            //隐藏级联选择组件
            $("#category-wrapper-tip").css("display","none");
            $("#category-wrapper").css("display","none");            
        }
    });
    //对于已经设置的类目则直接显示属性列表
    /**
    if(stuff.meta && stuff.meta.category)
        loadProps(item.meta.category);
    //**/
}

//修改目录映射
function changeCategoryMapping(){
    var name = "";
    if(Array.isArray(stuff.category)){
        name = stuff.category[stuff.category.length-1];
    }else if(stuff.category){
        var array = stuff.category.split(" ");
        name = array[array.length-1];
    }
    var platform_category = {
        platform:stuff.source,
        name:name,
        categoryId:stuff.meta.category
    };
    console.log("try to commit platform category.",platform_category);
    $.ajax({
        url:"https://data.shouxinjk.net/ilife/a/mod/platformCategory/rest/mapping",
        type:"post",
        data:JSON.stringify(platform_category),//注意：不能使用JSON对象
        //data:data,
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },
        success:function(res){
            console.log("upsert success.",res);
        },
        error:function(){
            console.log("upsert failed.",platform_category);
        }
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
      //index(item);
      commitData(item, function(){
        console.log("stuff item updated.");
      });
    }, "PATCH", item, header);
}


//设置一个定时器延缓提交：默认3秒自动提交一次，避免频繁提交导致大量请求
//commitTimer
var _sxTimer = null;
var _sxDataReceived = null;//milliseconds while receiving data
var _sxDuration = 3000;//milliseconds from data received to commit
function commitData(data, callback){
    //set initially received time 
    if(!_sxDataReceived){
        _sxDataReceived = new Date().getTime();
    }    
    //check duration and clear timer
    if(_sxTimer && new Date().getTime()-_sxDataReceived < _sxDuration){
        console.log("try to clear timer for too frequent data commit.");
        clearTimeout(_sxTimer);   
        _sxTimer = null;
    }
    //(re)start a new timer to commit data
    _sxTimer = setTimeout(function(){
        console.log("commit data timer start.",data);
        //发起数据提交
        index(data);
        if(callback && typeof callback === "function"){
            callback();
        }        
    },_sxDuration);    
    //设置数据接收时间
    _sxDataReceived = new Date().getTime();

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
            loadWxGroups(broker.id);//加载该达人的微信群
            showSelectionBtns();//如果是达人则显示选品库按钮
            //显示评价图：
            if(stuff.meta && stuff.meta.category){
                showRadar();//显示评价图
                showSankey();
                if(!stuff.poster)
                    requestPosterScheme();//请求并生成海报：仅在没生成海报时才自动请求生成全部海报               
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
        }else{//如果不是达人，则直接跳转到第三方商城，便于成单
            var  directUrl = window.location.href.replace(/info2/,"go");
            window.location.href=directUrl;
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
    }else{//检查首次触达达人
        benificiaryBrokerId=util.getInitBroker();
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
                siiimpleToast.message('口令已复制，请打开'+item.distributor.name,{
                  position: 'bottom|center'
                }); 
                /**
                $.toast({//浮框提示打开APP
                    heading: '需要在APP购买',
                    text: '口令已复制，打开'+item.distributor.name+'APP吧',
                    showHideTransition: 'fade',
                    icon: 'success'
                });    
                //**/          
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

//优先从ES获取数据，仅在无法获取时尝试从Arango获取
function loadItem(key){//获取内容列表
    $.ajax({
        url:app.config.search_api+"/stuff/doc/"+key,
        type:"get",
        data:{},
        success:function(data){
            stuff = data._source;//本地保存，用于分享等后续操作
            showContent(data._source);

            //显示评价树
            if(stuff.meta && stuff.meta.category){
                showDimensionBurst();
            }

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

//废弃：禁止直接从arangodb获取数据，直接从ES获取
/**
function loadItem(key){//获取内容列表
    $.ajax({
        url:"https://data.shouxinjk.net/_db/sea/my/stuff/"+key,
        type:"get",
        data:{},
        success:function(data){
            stuff = data;//本地保存，用于分享等后续操作
            showContent(data);

            //显示评价树
            if(stuff.meta && stuff.meta.category){
                showDimensionBurst();
            }

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
//**/

//加载预定义用户标签：仅加载用户行为标签，补充用户行为数据
var userTags = {};
function loadUserActionTags(){
   var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 
    console.log("try to load user tags.");
    util.AJAX(app.config.sx_api+"/mod/userTag/rest/tags?types=useraction-setting", function (res) {
        if(res){
            showUserActionTags(res);//直接开始显示
        }
    }, "GET",{},header);    
}
function showUserActionTags(tags){
    if(!tags || tags.length==0)
        return;
    for(var i=0;i<tags.length;i++){
        //缓存
        userTags[tags[i].id] = tags[i];
        //显示到界面
        $("#useraction-labeling-box").append('<div class="user-tag" id="user-tag-'+tags[i].id+'" data-id="'+tags[i].id+'">'+tags[i].name+'</div>');
        //注册点击事件
        var tagName = tags[i].name;
        var tagExpr = tags[i].expression;
        $("#user-tag-"+tags[i].id).click(function(evt){
            var clickedTagId = $(this).data("id");
            console.log("user action tag clicked.",clickedTagId);
            try{
                eval(userTags[clickedTagId].expression);
                $("#user-tag-"+clickedTagId).removeClass("user-tag");
                $("#user-tag-"+clickedTagId).addClass("user-tag-selected");
            }catch(err){
                console.log("failed eval tag expression",err);
            }
        });
    } 
    $("#useraction-labeling-box").css("display","block");   
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
        url:app.config.sx_api+"/mod/channel/rest/channels/active",
        type:"get",
        success:function(msg){
            var navObj = $(".navUl");
            for(var i = 0 ; i < msg.length ; i++){
                navObj.append("<li data='"+msg[i].id+"'>"+msg[i].name+"</li>");
                if(currentCategory == msg[i].id)//高亮显示当前选中的category
                    $(navObj.find("li")[i]).addClass("showNav");
            }
            //showCategorySwiper();//显示为滑动条:采用ul li元素，当前不能工作
            //注册点击事件
            navObj.find("li").click(function(){
                var key = $(this).attr("data");
                //跳转到首页
                window.location.href = "index.html?category="+key;
            })
        }
    })    
}


//将顶部类目显示为滑动条
function showCategorySwiper(){ 
    //显示滑动条
    var mySwiper = new Swiper ('.swiper-container', {
        slidesPerView: 8,
    });  
    /*
    //调整swiper 风格，使之悬浮显示
    $(".swiper-container").css("position","relative");
    $(".swiper-container").css("left","0");
    $(".swiper-container").css("top","40");
    $(".swiper-container").css("z-index","999");
    $(".swiper-container").css("background-color","red");
    //$(".swiper-container").css("margin-bottom","3px");
    //**/
     
}


//生成客观评价蒙德里安格子图。每一个单品都值得拥有
//1，查询得到客观评价构成，包含id、名称、占比；包含关联的属性节点
//2，查询fact及info，得到已经计算的标注值
//3，组装treemap数据结构，如果没有计算值则根据标注反向计算
//4，生成格子图并显示
var itemInfos = null;//默认为null。如果返回为空则为空数组
function showDimensionMondrian(){
    //根据category获取客观评价数据
    var data={
        categoryId:stuff.meta.category
    };

    if(!measureScheme || measureScheme.length==0){
        console.log("try to load dimension data.",data);
        util.AJAX(app.config.sx_api+"/mod/itemDimension/rest/dim-tree-by-category", function (res) {
            console.log("======\nload dimension.",data,res);
            if (res.length>0) {//构建数据集
                measureScheme = res;
                if(measureScheme && measureScheme.length>0)
                    buildMondrianDataset();
            }else{//没有则啥也不干
                //do nothing
                console.log("failed load dimension tree.",data);
            }
        },"GET",data);         
    }else{
        buildMondrianDataset();
    }
    
    /**
    //由于数据为扁平结构，单个条目数据无法构建treemap
    //根据itemKey查询info
    $.ajax({
        url:app.config.analyze_api+"?query=select dimensionId,score from ilife.info where dimensionType=0 and itemKey='"+stuff._key+"' order by ts format JSON",
        type:"get",
        //data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },         
        success:function(ret){
            console.log("===got item score===\n",ret);
            itemInfos = ret.data;
            buildMondrianDataset();
        }
    });   
    //**/  
}

//构建蒙德里安格子画数据集
//根据评价维度及评价数据得到
/**
{
    value:xxx,//根据总量计算得到
    color:xxx, //通过chooseMondrianColor得到
    children:xxx
}
//**/
var colorRatio = {red:0.2,yellow:0.4,blue:0.1,black:0.1};
function buildMondrianDataset(){
    if( !measureScheme || measureScheme.length==0 || !itemInfos )//注意仅检查评价结构，数据无需检查。itemInfos如果没有数据为：[]
        return;

    //先根据权重排序，仅取前4个高权重维度设置颜色比例
    measureScheme.sort(function (s1, s2) {
      x1 = s1.weight;
      x2 = s2.weight;
      if (x1 < x2) {
          return 1;
      }
      if (x1 > x2) {
          return -1;
      }
      return 0;
    });
    //根据顶级评价维度占比 设置 默认颜色方案，只考虑权重大的前4个
    var i=0;
    measureScheme.forEach(function(entry){
        if(i==0)colorRatio.red = entry.weight*0.1;
        if(i==1)colorRatio.yellow = entry.weight*0.1;
        if(i==2)colorRatio.blue = entry.weight*0.1;
        if(i==3)colorRatio.black = entry.weight*0.1;
        i++;
    });
    var mondrianData = {};
    mondrianData.value = 100;//顶部默认为100
    //mondrianData.color = chooseMondrianColor(colorRatio.red,colorRatio.yellow,colorRatio.blue,colorRatio.black);
    mondrianData.color = chooseMondrianColor(colorRatio);
    mondrianData.children = generateModrianData(measureScheme);//递归构建

    //生成图片
    showMondrian(mondrianData);
}

//递归生成数据
function generateModrianData(childMeasureScheme){
    //console.log("prepare mondrian record.",childMeasureScheme);
    var child = [];
    childMeasureScheme.forEach(function(entry){
        console.log("prepare mondrian record.",entry);
        var  node = {}; 
        node.value = entry.weight;
        //node.color = chooseMondrianColor(colorRatio.red,colorRatio.yellow,colorRatio.blue,colorRatio.black);
        node.color = chooseMondrianColor(colorRatio);
        if(entry.children && entry.children.length>0)
            node.children = generateModrianData(entry.children);//递归构建
        child.push(node);
    });
    return child;
}

function showMondrian(data){
    //显示标题：
    $("#mondrianTitle").css("display","block");
    //显示sunburst图表    
    Mondrian("#mondrian",data, {
      w: width,//默认为整屏宽度
      h: width*9/16//采用16:9
    });

    //将生成的客观评价图片提交到fdfs
    var canvas = $("#mondrian svg")[0];
    console.log("got canvas.",canvas);
    //调用方法转换即可，转换结果就是uri,
    var width = $(canvas).attr("width");
    var height = $(canvas).attr("height");
    var options = {
            encoderOptions:1,
            //scale:2,
            scale:1,
            //left:-1*Number(width)/2,
            //top:-1*Number(height)/2,
            left:0,
            top:0,
            width:Number(width),
            height:Number(height)
        };
    svgAsPngUri(canvas, options, function(uri) {
        //console.log("image uri.",dataURLtoFile(uri,"dimension.png"));
        //将图片提交到服务器端。保存文件文件key为：measure-scheme
        uploadPngFile(uri, "mondrian.png", "mondrian");//文件上传后将在stuff.media下增加{measure-scheme:imagepath}键值对
    });  
}


//generate and show sankey chart
//step1: query link tree by meta.category
//step2: query calculated full measure and info data by itemKey
//step3: assemble single item dataset
//step4: show sankey chart    
var linkTree = [];
var linkNodes = [];
function showSankey(){

    //获取link tree，包含维度-维度，维度-属性
    $.ajax({
        url:app.config.sx_api+"/mod/itemDimension/rest/link-tree-by-category",
        type:"get",
        //async:false,//同步调用
        data:{categoryId:stuff.meta.category},
        success:function(ret){
            console.log("===got link tree===\n",ret);
            linkTree = ret;
            //遍历得到nodes
            linkTree.forEach(function(entry){//逐条解析，将不同节点放入nodes
                //source节点
                var idx = linkNodes.findIndex((node) => node.id==entry.source.id);
                if(idx<0)
                    linkNodes.push(entry.source);
                //target节点
                idx = linkNodes.findIndex((node) => node.id==entry.target.id);
                if(idx<0)
                    linkNodes.push(entry.target);
            });
            generateSankeyChart();//此处触发根据weight显示：因为尚未装载得分
        }
    });  

    //显示标题：
    $("#sankeyTitle").css("display","block");

    //根据itemKey获取客观评价结果
    $.ajax({
        url:app.config.analyze_api+"?query=select dimensionId,score from ilife.info where dimensionType=0 and itemKey='"+stuff._key+"' order by ts format JSON",
        type:"get",
        //async:false,//同步调用
        data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },  
        success:function(json){
            console.log("===got info score===\n",json);
            for(var i=0;i<json.rows;i++){
                var idx = linkTree.findIndex((linkItem) => linkItem.source.id==json.data[i].dimensionId);
                if(idx>-1){
                    var linkItem = linkTree[idx];
                    linkItem["value"] = json.data[i].score * linkItem.weight;
                    linkTree.splice(idx,1,linkItem);//替换掉原来的条目，增加value
                }
            }
            generateSankeyChart();
        }
    });  

    //根据itemKey获取fact
    $.ajax({
        url:app.config.analyze_api+"?query=select propertyId,score,ovalue from ilife.fact where itemKey='"+stuff._key+"' order by ts format JSON",
        type:"get",
        //async:false,//同步调用
        data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },  
        success:function(json){
            console.log("===got fact score===\n",json);
            for(var i=0;i<json.rows;i++){
                //在linktree上增加value，用于计算宽度
                var idx = linkTree.findIndex((linkItem) => linkItem.source.id==json.data[i].propertyId);
                if(idx>-1){
                    var linkItem = linkTree[idx];
                    linkItem["value"] = json.data[i].score * linkItem.weight;      
                    linkTree.splice(idx,1,linkItem);//替换掉原来的条目，增加value     
                }    
                //在linknodes上增加原始值，用于显示 
                idx = linkNodes.findIndex((node) => node.id==json.data[i].propertyId);
                if(idx>-1){
                    var linkNode = linkNodes[idx];
                    if(linkNode.name.indexOf(":")>0) //避免重复处理，CK内可能存在重复记录
                        break;
                    var ovalue = json.data[i].ovalue;
                    if(!ovalue){ //如果没有则采用默认值
                        ovalue = linkNode.defaultValue;
                    }
                    if(ovalue && ovalue.length>30){ //超长则截断
                        ovalue = ovalue.substr(0,29);
                    }

                    if(ovalue){ //更换linknode的name
                        linkNode.name = linkNode.name +":"+ovalue;
                    }else{
                        linkNode.name = linkNode.name +":未标注";
                    }
                    linkNodes.splice(idx,1,linkNode);//替换掉原来的条目，增加value 
                }
            }
            generateSankeyChart();
        }
    });      
}

//显示sankey图，需要在数据ready后开始
function generateSankeyChart(){
    if( linkTree.length==0 || linkNodes.length==0 ){
        console.log("sankey chart not ready. ignore.");
        return;
    }
    //generate sankey chart.
    console.log("try render sankey chart.",linkNodes,linkTree);
    if(d3Sankey){
        var sankeyChartOptions = {
          height:600
        };
        //genrate sankey
        SankeyChart("#sankey", {
                    nodes:linkNodes,
                    links: linkTree
                }, {
                  nodeGroup: d => d.id.split(/\W/)[0], // take first word for color
                  nodeId: d => d.id,
                  nodeLabel: d => d.name, //name显示包含属性名称，即属性原始值或默认值：需要在加载props时设置
                  //format: (f => d => `${f(d)} TWh`)(d3.format(",.1~f")),
                  linkSource: ({source}) => source.id,
                  linkTarget: ({target}) => target.id,
                  height: 600
                });        
    }

    //将生成的sankey片提交到fdfs
    var canvas = $("#sankey svg")[0];
    console.log("got canvas sankey.",canvas);
    //调用方法转换即可，转换结果就是uri,
    var width = $(canvas).attr("width");
    var height = $(canvas).attr("height");
    var options = {
        encoderOptions:1,
        //scale:2,
        scale:1,
        left:0,
        top:0,
        width:Number(width),
        height:Number(height)
    };
    svgAsPngUri(canvas, options, function(uri) {
        console.log("image uri.",dataURLtoFile(uri,"sankey.png"));
        //$("#radarImg").append('<img width="'+Number(width)+'" height="'+Number(height)+'" src="' + uri + '" alt="请长按保存"/>');
        //TODO： 将图片提交到服务器端。保存文件名为：itemKey-d.png
        uploadPngFile(uri, "measure-sankey.png", "sankey");//文件上传后将在stuff.media下增加{measure:imagepath}键值对
    });       
}


//加载类目维度、商品得分、类目得分，并显示雷达图
//注意：此处存在重复加载：
//对于已经有meta.category的条目，在loadMeasureAndScore内会加载当前条目的维度及得分，此处仅在用于显示
//对于缺乏meta.category的条目，在重新选择meta.category后将加载默认值
function showRadar(){
    $.ajax({
        url:app.config.sx_api+"/mod/itemDimension/rest/featured-dimension",
        type:"get",
        //async:false,//同步调用
        data:{categoryId:stuff.meta.category},
        success:function(json){
            console.log("===got featured dimension===\n",json);
            featuredDimension = json;
            generateRadarChart();
        }
    });  
    

    //根据itemKey获取评价结果
    //feature = 1；dimensionType：0客观评价，1主观评价
    //var itemScore = {};
    $.ajax({
        url:app.config.analyze_api+"?query=select dimensionId,score from ilife.info where feature=1 and dimensionType=0 and itemKey='"+stuff._key+"' order by ts format JSON",
        type:"get",
        //async:false,//同步调用
        data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },  
        success:function(json){
            console.log("===got item score===\n",json);
            for(var i=0;i<json.rows;i++){
                itemScore[json.data[i].dimensionId] = json.data[i].score;//*10;
            }
            generateRadarChart();
        }
    });  

    //根据categoryId获取评价结果
    //feature = 1；dimensionType：0客观评价，1主观评价
    //var categoryScore = {};
    $.ajax({
        url:app.config.analyze_api+"?query=select dimensionId,avg(score) as score from ilife.info where feature=1 and dimensionType=0 and categoryId='"+stuff.meta.category+"' group by dimensionId format JSON",
        type:"get",
        //async:false,//同步调用
        data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },  
        success:function(json){
            console.log("===got category score===\n",json);
            for(var i=0;i<json.rows;i++){
                categoryScore[json.data[i].dimensionId] = json.data[i].score;//*10;
            }
            generateRadarChart();
        }
    });    

    //未能获取维度列表则直接返回
    if(!featuredDimension || featuredDimension.length ==0)
        return;

    //显示标题：
    $("#radarTitle").css("display","block");
    $("#mscoreTitle").css("display","block");

    //生成雷达图
    generateRadarChart();

}

function generateRadarChart(){
    if(featuredDimension.length==0 || Object.keys(itemScore).length==0 || Object.keys(categoryScore).length==0){
        console.log("radar chart not ready. ignore.");
        return;
    }
    var margin = {top: 60, right: 60, bottom: 60, left: 60},
        width = Math.min(700, window.innerWidth - 10) - margin.left - margin.right,
        height = Math.min(width, window.innerHeight - margin.top - margin.bottom - 20);
    //query item measure data
    var data = [];
    //组装展示数据：根据维度遍历。
    var itemArray = [];
    var categoryArray = [];
    for(var i=0;i<featuredDimension.length;i++){
        var dimId = featuredDimension[i].id;
        var dimName = featuredDimension[i].name;
        itemArray.push({
            axis:dimName,
            value:itemScore[dimId]?itemScore[dimId]*10:5
        });
        categoryArray.push({
            axis:dimName,
            value:categoryScore[dimId]?categoryScore[dimId]*10:7.5
        });       
    }

    data = [];
    data.push(itemArray);
    data.push(categoryArray);

    //generate radar chart.
    //TODO: to put in ajax callback
    var color = d3.scaleOrdinal(["#CC333F","#EDC951","#00A0B0"]);
        
    var radarChartOptions = {
      w: width,
      h: height,
      margin: margin,
      maxValue: 10,
      levels: 5,
      roundStrokes: true,
      color: color
    };
    //genrate radar
    RadarChart("#radar", data, radarChartOptions);

    //将生成的客观评价图片提交到fdfs
    var canvas = $("#radar svg")[0];
    console.log("got canvas.",canvas);
    //调用方法转换即可，转换结果就是uri,
    var width = $(canvas).attr("width");
    var height = $(canvas).attr("height");
    var options = {
        encoderOptions:1,
        //scale:2,
        scale:1,
        left:0,
        top:0,
        width:Number(width),
        height:Number(height)
    };
    svgAsPngUri(canvas, options, function(uri) {
        //console.log("image uri.",dataURLtoFile(uri,"dimension.png"));
        //$("#radarImg").append('<img width="'+Number(width)+'" height="'+Number(height)+'" src="' + uri + '" alt="请长按保存"/>');
        //TODO： 将图片提交到服务器端。保存文件名为：itemKey-d.png
        uploadPngFile(uri, "measure-radra.png", "measure");//文件上传后将在stuff.media下增加{measure:imagepath}键值对
    });       
}

var featuredDimension = [];//客观评价维度列表
var itemScore = {};//当前条目评分列表：手动修改后同时缓存
var categoryScore = {};//当前条目所在类目评分列表
var measureScores = [];//显示到grid供修改，在measure基础上增加score
var hasCategoryProps = false; //记录是否已经加载类目属性
var hasAdviceSchemes = false; //记录是否已加载推荐语模板
function loadMeasureAndScore(){
    if(!hasCategoryProps || !hasAdviceSchemes){
        console.log("measure and score are not ready. ignore.");
        return;
    }
    console.log("start show measure and score.");
    //根据category获取客观评价数据
    var data = {
        categoryId:stuff.meta.category
    };
    util.AJAX(app.config.sx_api+"/mod/itemDimension/rest/dim-tree-by-category", function (res) {
        console.log("======\nload dimension.",data,res);
        if (res.length>0) {//本地存储评价数据
            measureScheme = res;
        }else{//没有则啥也不干
            //do nothing
            console.log("failed load dimension tree.",data);
        }
    },"GET",data); 

    //获取类目下的特征维度列表
    $.ajax({
        url:app.config.sx_api+"/mod/itemDimension/rest/featured-dimension",
        type:"get",
        async:false,//同步调用
        data:{categoryId:stuff.meta.category},
        success:function(json){
            console.log("===got featured dimension===\n",json);
            featuredDimension = json;
            //准备默认值
            for(var i=0;i<json.length;i++){
                var entry = json[i];
                itemScore[entry.id] = (entry.score&&entry.score>0)?entry.score:0.75;
                categoryScore[entry.id] = 0.5;
            }
        }
    });  

    //根据itemKey获取评价结果
    //feature = 1；dimensionType：0客观评价，1主观评价
    //注意：由于clickhouse非严格唯一，需要取最后更新值
    $.ajax({
        url:app.config.analyze_api+"?query=select dimensionId,score from ilife.info where feature=1 and dimensionType=0 and itemKey='"+stuff._key+"' order by ts format JSON",
        type:"get",
        async:false,//同步调用
        //data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },         
        success:function(json){
            console.log("===got item score===\n",json);
            for(var i=0;i<json.rows;i++){
                itemScore[json.data[i].dimensionId] = json.data[i].score;
            }
            console.log("===assemble item score===\n",itemScore);
        }
    });  

    //根据categoryId获取评价结果
    //feature = 1；dimensionType：0客观评价，1主观评价
    $.ajax({
        url:app.config.analyze_api+"?query=select dimensionId,avg(score) as score from ilife.info where feature=1 and dimensionType=0 and categoryId='"+stuff.meta.category+"' group by dimensionId format JSON",
        type:"get",
        async:false,//同步调用
        //data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },         
        success:function(json){
            console.log("===got category score===\n",json);
            for(var i=0;i<json.rows;i++){
                categoryScore[json.data[i].dimensionId] = json.data[i].score;
            }
            console.log("===assemble category score===\n",categoryScore);
        }
    });     

    //组装measureScore
    for(var i=0;i<featuredDimension.length;i++){
        var measureScore = featuredDimension[i];
        measureScore.score = itemScore[measureScore.id]?itemScore[measureScore.id]:0.75;
        measureScores.push(measureScore);
    }

    //显示雷达图
    //if(!stuff.media || !stuff.media["measure"])//仅在第一次进入时才尝试自动生成
        showRadar();//显示评价图
        showSankey();

    //显示蒙德里安格子图
    //if(!stuff.media || !stuff.media["mondrian"])//仅在第一次进入时才尝试自动生成
        showDimensionMondrian();//显示评价图

    //显示measureScore表格提供标注功能
    showMeasureScores();
}
//显示客观评价得分表格，便于手动修改调整
var tmpScores = {};
function showMeasureScores(){
    //准备评分表格：逐行显示
    for(var i=0;i<measureScores.length;i++){
        tmpScores[measureScores[i].id] = measureScores[i];
        var html = "";
        html += "<div style='display:flex;flex-direction:row;flex-wrap:nowrap;margin:10px 0;width:100%;font-size:12px;'>";
        html += "<div style='width:30%;line-height:24px;text-align:right;font-weight:bold;overflow: hidden;text-overflow: ellipsis;white-space: nowrap;'>"+measureScores[i].name+"</div>";
        html += "<div style='width:7%;text-align:center;line-height:24px;' id='mscore"+measureScores[i].id+"'>"+(measureScores[i].score*10).toFixed(1)+"</div>";
        html += "<div style='width:63%' id='score"+measureScores[i].id+"'></div>";
        html += "</div>";
        $("#measuresList").append(html);//装载到界面

        //对达人开放标注能力：
        if((broker && broker.id)||(app.globalData.brokerInfo && app.globalData.brokerInfo.id)){
            $("#score"+measureScores[i].id).starRating({//显示为starRating
                totalStars: 10,
                starSize:20,
                useFullStars:false,//能够显示半星
                initialRating: measureScores[i].score*10,//注意：评分是0-1,直接转换
                ratedColors:['#8b0000', '#dc143c', '#ff4500', '#ff6347', '#1e90ff','#00ffff','#40e0d0','#9acd32','#32cd32','#228b22'],
                callback: function(currentRating, el){
                    //获取当前评价指标
                    var measureId = $(el).attr("id").replace(/score/g,'');
                    var old = tmpScores[measureId];
                    console.log("dude, now try update rating.[old]",measureId,old,currentRating);
                    //保存到本地
                    var newScore = currentRating*0.1;//直接转换到0-1区间
                    itemScore[measureId] = newScore;
                    $("#mscore"+measureId).html(newScore.toFixed(2));
                    $("#radarImg").empty();//隐藏原有图片
                    showRadar();//重新生成雷达图
                    showSankey();

                    //提交数据并更新
                    var priority = old.parentIds.length - old.parentIds.replace(/\,/g,"").length;
                    $.ajax({
                        url:app.config.analyze_api+"?query=insert into ilife.info values ('"+stuff._key+"','"+stuff.meta.category+"','"+old.id+"','"+old.propKey+"',0,"+priority+",1,"+old.weight+",'"+old.script+"',"+newScore+",0,now())",
                        type:"post",
                        //data:{},
                        headers:{
                            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
                        },         
                        success:function(json){
                            console.log("===measure score updated===\n",json);
                        }
                    });  
                }
            });  
        }   
    }
    //显示属性列表
    $("#measuresDiv").css("display","block");      
}

//上传图片到fast-poster，便于海报生成
//**
function uploadPngFile(dataurl, filename, mediaKey){
    var formData = new FormData();
    formData.append("file", dataURLtoFile(dataurl, filename));//注意，使用files作为字段名
    if(stuff.media&&stuff.media[mediaKey]&&stuff.media[mediaKey].indexOf("group")>0){//已经生成过的会直接存储图片链接，链接中带有group信息
        var oldFileId = stuff.media[mediaKey].split("group")[1];//返回group后的字符串，后端将解析
        console.log("got old fileid.[fileId]"+oldFileId);
        formData.append("fileId", oldFileId);//传递之前已经存储的文件ID，即group之后的部分，后端根据该信息完成历史文件删除
    }else{
        formData.append("fileId", "");//否则设为空
    }
    $.ajax({
         type:'POST',
         url:app.config.poster_api+"/api/upload",
         data:formData,
         contentType:false,
         processData:false,//必须设置为false，不然不行
         dataType:"json",
         mimeType:"multipart/form-data",
         success:function(data){//把返回的数据更新到item
            console.log("chart file uploaded. try to update item info.",data);
            console.log("image path",app.config.file_api+"/"+data.fullpath);
            //将返回的media存放到stuff
            if(data.code ==0 && data.url.length>0 ){//仅在成功返回后才操作
                if(!stuff.media)
                    stuff.media = {};
                stuff.media[mediaKey] = app.config.poster_api+"/"+data.url;
                submitItemForm();//提交修改
            }
         }
     }); 
}
//**/

//上传图片文件到服务器端保存，用于海报生成
//mediaKey：用于指出在item.media下的key
/**
function uploadPngFile(dataurl, filename, mediaKey){
    var formData = new FormData();
    formData.append("files", dataURLtoFile(dataurl, filename));//注意，使用files作为字段名
    if(stuff.media&&stuff.media[mediaKey]&&stuff.media[mediaKey].indexOf("group")>0){//已经生成过的会直接存储图片链接，链接中带有group信息
        var oldFileId = stuff.media[mediaKey].split("group")[1];//返回group后的字符串，后端将解析
        console.log("got old fileid.[fileId]"+oldFileId);
        formData.append("fileId", oldFileId);//传递之前已经存储的文件ID，即group之后的部分，后端根据该信息完成历史文件删除
    }else{
        formData.append("fileId", "");//否则设为空
    }
    $.ajax({
         type:'POST',
         url:app.config.sx_api+"/rest/api/upload",
         data:formData,
         contentType:false,
         processData:false,//必须设置为false，不然不行
         dataType:"json",
         mimeType:"multipart/form-data",
         success:function(data){//把返回的数据更新到item
            console.log("chart file uploaded. try to update item info.",data);
            console.log("image path",app.config.file_api+"/"+data.fullpath);
            //将返回的media存放到stuff
            if(data.fullpath && data.group.length>0 && data.fullpath.length>6){//仅在成功返回后才操作
                if(!stuff.media)
                    stuff.media = {};
                stuff.media[mediaKey] = app.config.file_api+"/"+data.fullpath;
                submitItemForm();//提交修改
            }
         }
     }); 
}
//**/

//转换base64为png文件
function dataURLtoFile(dataurl, filename) {
  // 获取到base64编码
  const arr = dataurl.split(',')
  // 将base64编码转为字符串
  const bstr = window.atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n) // 创建初始化为0的，包含length个元素的无符号整型数组
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new File([u8arr], filename, {
    type: 'image/png',//固定为png格式
  })
}

//生成商品海报：先获得海报列表
function requestPosterScheme(){
    //仅对已经确定类目的商品进行
    if(!stuff.meta || !stuff.meta.category)
        return;

    $.ajax({
        url:app.config.sx_api+"/mod/posterTemplate/rest/item-templates",
        type:"get",
        data:{categoryId:stuff.meta.category},
        success:function(schemes){
            console.log("\n===got item poster scheme ===\n",schemes);
            //遍历海报并生成
            for(var i=0;i<schemes.length;i++){
                //传递broker/stuff/userInfo作为海报生成参数
                requestPoster(schemes[i],broker,stuff,app.globalData.userInfo);
            }
        }
    });  
}

//生成海报，返回海报图片URL
//注意：海报模板中适用条件及参数仅能引用这三个参数
function requestPoster(scheme,xBroker,xItem,xUser){
    //判断海报模板是否匹配当前条目
    var isOk = true;
    if(scheme.condition && scheme.condition.length>0){//如果设置了适用条件则进行判断
        console.log("\n===try eval poster condition===\n",scheme.condition);
        try{
            isOk = eval(scheme.condition);
        }catch(err){
            console.log("\n=== eval poster condition error===\n",err);
        }
        console.log("\n===result eval poster condition===\n",isOk);
    }
    if(!isOk){//如果不满足则直接跳过
        console.log("condition not satisifed. ignore.");
        return;       
    }

    //检查是否已经生成，如果已经生成则不在重新生成
    if(stuff.poster && stuff.poster[scheme.id]){
        console.log("\n=== poster exists. ignore.===\n");
        return;
    }

    //准备海报参数
    console.log("\n===try eval poster options===\n",scheme.options);
    try{
        eval(scheme.options);//注意：脚本中必须使用 var xParam = {}形式赋值
    }catch(err){
        console.log("\n=== eval poster options error===\n",err);
        return;//这里出错了就别玩了
    }
    console.log("\n===eval poster options===\n",xParam);
    var options = {//merge参数配置
                  ...app.config.poster_options,//静态参数：accessKey、accessSecret信息
                  ...xParam //动态参数：配置时定义
                }
    console.log("\n===start request poster with options===\n",options);
    //请求生成海报
    $.ajax({
        url:app.config.poster_api+"/api/link",
        type:"post",
        data:JSON.stringify(options),
        success:function(res){
            console.log("\n===got item poster info ===\n",res);
            //将海报信息更新到stuff
            if(res.code==0 && res.url && res.url.length>0){
                if(!stuff.poster)
                    stuff.poster = {};
                stuff.poster[scheme.id] = res.url;//以schemeId作为键值存储poster
                submitItemForm();//提交修改
                //显示到界面
                var showPoster = false;
                if(showPoster){
                    $("#poster").append("<div class='prop-row'><img style='object-fill:cover;width:100%' src='"+res.url+"'/></div>");
                    $("#posterTitle").css("display","block"); 
                }
            }
        }
    });     
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
    };
    console.log("try to load dimension data.",data);
    util.AJAX(app.config.sx_api+"/mod/itemDimension/rest/dim-tree-by-category", function (res) {
        console.log("======\nload dimension.",data,res);
        if (res.length>0) {//显示图形
            showSunBurst({name:stuff.meta.categoryName?stuff.meta.categoryName:"评价规则",children:res});
        }else{//没有则啥也不干
            //do nothing
            console.log("failed load dimension tree.",data);
        }
    },"GET",data);    
}

function showSunBurst(data){
    //显示标题：
    $("#sunburstTitle").css("display","block");
    //显示赞同或不赞同评价规则：
    $("#sunburstReview").css("display","flex");    
    //显示sunburst图表    
    Sunburst("#sunburst",data, {
      value: d => d.weight, // weight 
      label: d => d.name, // name
      title: (d, n) => `${n.ancestors().reverse().map(d => d.data.name).join(".")}\n${n.value.toLocaleString("en")}`, // hover text
//      link: (d, n) => n.children
//        ? `https://github.com/prefuse/Flare/tree/master/flare/src/${n.ancestors().reverse().map(d => d.data.name).join("/")}`
//        : `https://github.com/prefuse/Flare/blob/master/flare/src/${n.ancestors().reverse().map(d => d.data.name).join("/")}.as`,
      width: 400,
      height: 400
    });

    //将生成的客观评价图片提交到fdfs
    var canvas = $("#sunburst svg")[0];
    console.log("got canvas.",canvas);
    //调用方法转换即可，转换结果就是uri,
    var width = $(canvas).attr("width");
    var height = $(canvas).attr("height");
    var options = {
            encoderOptions:1,
            //scale:2,
            scale:1,
            left:-1*Number(width)/2,
            top:-1*Number(height)/2,
            width:Number(width),
            height:Number(height)
        };
    svgAsPngUri(canvas, options, function(uri) {
        //console.log("image uri.",dataURLtoFile(uri,"dimension.png"));
        //将图片提交到服务器端。保存文件文件key为：measure-scheme
        uploadPngFile(uri, "measure-sunburst.png", "measure-scheme");//文件上传后将在stuff.media下增加{measure-scheme:imagepath}键值对
    });  
}


function submitItemForm(){
    //获取变化的数据
    currentItem = stuff;

    //添加当前采集达人数据
    if($.cookie("sxAuth") && $.cookie("sxAuth").trim().length>0){
        var sxAuth = JSON.parse($.cookie("sxAuth"));
        if(sxAuth.openid){
            if(!currentItem.task)currentItem.task={};
            currentItem.task.user = sxAuth.openid;
        }
    }

    //仅提交标注数据，其他数据不做提交，避免覆盖服务器侧数据更新
    var changedItem = {
        _key:currentItem._key?currentItem._key:hex_md5(currentItem.url),
        task:{
            user:currentItem.task&&currentItem.task.user?currentItem.task.user:(app.globalData&&app.globalData.userInfo&&app.globalData.userInfo._key?app.globalData.userInfo._key:"dummy")
        },
        title:currentItem.title,
        summary:currentItem.summary
    }
    if(currentItem.meta && currentItem.meta.category){
        changedItem.meta = {
            category:currentItem.meta.category
        }
    }
    if(currentItem.tagging)
        changedItem.tagging = currentItem.tagging;
    if(currentItem.props)
        changedItem.props = currentItem.props;

    if(_sxdebug)console.log("try to commit data.",currentItem/*,changedItem*/);

    //记录采集历史：重要，单个达人或机构能够根据历史获取其采集的历史列表 
    var curUser = currentItem.task&&currentItem.task.user?currentItem.task.user:(app.globalData&&app.globalData.userInfo&&app.globalData.userInfo._key?app.globalData.userInfo._key:"dummy");
    logstash(currentItem,"mp","label",curUser,broker.id,function(){
      //do nothing
    }); 

    var data = {
        records:[{
            value:currentItem//changedItem
        }]
    };
    $.ajax({
        url:"https://data.shouxinjk.net/kafka-rest/topics/stuff",
        type:"post",
        data:JSON.stringify(data),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/vnd.kafka.json.v2+json",
            "Accept":"application/vnd.kafka.v2+json"
        },
        success:function(result){
            //do nothing
            /**
            $.toast({
                heading: 'Success',
                text: '已提交成功',
                showHideTransition: 'fade',
                icon: 'success'
            });
            //**/
            //切换到来源页面，便于进入其他站点继续采集数据
        }
    });

    //同时将当前的类目映射添加到platform_categories
    if(currentItem.meta && currentItem.meta.category){
        var platform_category = {
            platform:currentItem.source,
            name:currentItem.category,
            categoryId:currentItem.meta.category
        };
        console.log("try to commit platform category.",platform_category);
        $.ajax({
            url:"https://data.shouxinjk.net/ilife/a/mod/platformCategory/rest/mapping",
            type:"post",
            data:JSON.stringify(platform_category),//注意：不能使用JSON对象
            //data:data,
            headers:{
                "Content-Type":"application/json",
                "Accept": "application/json"
            },
            success:function(res){
                console.log("upsert success.",res);
            },
            error:function(){
                console.log("upsert failed.",platform_category);
            }
        });  
    }    

}

//解析json得到key value对
var docKeyValues = {};
function parseJsonKeyValues(json,prefix){
    Object.keys(json).forEach(function(key){
        //处理数值，或者递归到下一级
        if(json[key]){
            if( $.type(json[key])=== "object"){ //如果是对象则递归
                console.log("got plain object.",json[key]);
                parseJsonKeyValues(json[key],prefix+key+".");                
            }else if( $.type(json[key])=== "string"){ //如果是字符串值
                console.log("got string.",json[key]);
                docKeyValues[prefix+key] = json[key];//直接写入           
            }else if( $.type(json[key])=== "number"){ //如果是数值
                console.log("got number.",json[key]);
                docKeyValues[prefix+key] = json[key];//直接写入           
            }else if( $.type(json[key])=== "array"){ //如果是数组：当前不支持。已经在系统界面上单独提供
                console.log("got array.ignore.",json[key]);
                //docKeyValues[prefix+key] = json[key];//直接写入           
            }else{
                //ignore
                console.log("unknown object type.ignore.",json[key]);
            }
        }
    });
}

//根据ItemCategory类别，获取对应的属性配置，并与数据值融合显示
//1，根据key进行合并显示，以itemCategory下的属性为主，能够对应上的key显示绿色，否则显示红色
//2，数据显示，有对应于key的数值则直接显示，否则留空等待填写
function loadProps(categoryId){
    //根据categoryId获取所有measure清单，字段包括name、property
    $.ajax({
        url:"https://data.shouxinjk.net/ilife/a/mod/measure/measures?cascade=true&noPrefix=true&category="+categoryId, //仅取当前类目下的直接属性
        type:"get",
        data:{},
        success:function(items){
            console.log("got measures.",items);
            //在回调内：1，根据返回结果组装待展示数据，字段包括：name、property、value、flag(如果在则为0，不在为1)
            //var props = stuff.props?stuff.props:[];//临时记录当前stuff的属性列表
            var props = [];
            console.log("props:"+JSON.stringify(stuff.props),stuff.props);
            if(Array.isArray(stuff.props)){//兼容以数组形式存储的props：来源于客户端爬虫
                props = stuff.props;//临时记录当前stuff的属性列表
            }else{//兼容{key:value,key:value}对象：来源于服务器端API采集数据
                for(var key in stuff.props){
                    console.log(key+":"+stuff.props[key]);//json对象中属性的名字：对象中属性的值
                    var prop = {};
                    prop[key]=stuff.props[key];
                    props.push(prop);
                }
            }

            //加载json文档内的非props属性，用于自动填写。
            //解析后得到扁平键值对： key:value 。其中key为 xxx.xxx形式，value为单一值
            //由于需要修改，采用复制对象处理
            var nstuff = JSON.parse(JSON.stringify(stuff));
            delete nstuff.props;
            delete nstuff.status;
            delete nstuff.timestamp;
            delete nstuff.profit;
            delete nstuff.advice;
            delete nstuff.media;
            delete nstuff.link;
            delete nstuff.images;
            delete nstuff.task;
            delete nstuff.tags;
            delete nstuff.tagging;
            //delete nstuff.source;
            //delete nstuff.seller;
            //delete nstuff.distributor;
            parseJsonKeyValues(nstuff,"");//解析得到doc内的数值，得到键值对
            console.log("got doc key value pairs.",docKeyValues);
            //**/

            //逐条装载属性记录。采用自动补全方式便于快速标注。每个属性显示一行。
            //装载时需要进行区分：
            //如果属性是商品的props属性则直接修改props.xxx数值；如果属性是json文本上的属性则直接修改json文档，如price.bid
            //同时需要根据商品属性映射增加自动提示：包括手动标注、字典标注、引用标注，需要分别获取数值，对于自动标注则开放填写，不提供自动补全
            var propHtmlTpl = `
            <div style="display:flex;flex-direction:row;flex-wrap:nowrap;width:100%;margin:1px auto;">
                <div class="prop-key" style="text-align:right;">__propName__propType</div>
                <div class="prop-value" style="vertical-align:middle;">
                    <input type="__type" value="__orgValue" id="__inputId" data-property="__property" data-targetproperty="__targetProperty" data-propname="__propName" data-ovalue="__orgValue" data-labeltype="__labelType" data-referdict="__referDict" data-refercategory="__referCategory" data-measureid="__measureId" placeholder="__placeholder" style="width:85%;line-height:18px;margin:2px 5px;padding:2px;border:1px solid silver;"/>
                </div>
            </div>
            `;                

              nodes = [];
              //先根据标准类目的属性组装，包含继承属性。
              //检查props内是否匹配，如果匹配则更新props下的属性，否则更新原始文档上的属性
              for( k in items ){
                /**
                if(Object.keys(docKeyValues).indexOf(k.property)>-1) //如果属性名和json自身的key值相同则忽略，表示已经在json文本内，不需要再次显示到props列表
                    continue;
                //**/

                var item = items[k];
                if(_sxdebug)console.log("measure:"+JSON.stringify(item) );
                if(item.isModifiable === "0") {//如果属性禁止手动修改则不显示
                    console.log("ignore not modifiable item.",item);
                    continue;
                }
                var name=item.name;
                var property = item.property;
                var value = props[property]?props[property]:"";
                //遍历props查找是否匹配，匹配包括两种情况，1键值匹配，包括带有props.的键值匹配，2键名匹配，包括带有props.前缀的键名匹配
                for(j in props){
                    var prop = props[j];
                    var _key = Object.keys(prop)[0];//得到当前prop的key值。注意没有props.前缀
                    if(_key===property || ("props."+_key)===property){//如果存在对应property：这是理想情况，多数情况下都只能通过name匹配
                        value = prop[_key];
                        props.splice(j, 1);//删除该元素，已经匹配上了，后续就不需要重复处理
                        break;
                    }else if(_key===name || ("props."+_key)===name){//如果匹配上name 也进行同样的处理
                        value = prop[_key];
                        props.splice(j, 1);//删除该元素，已经匹配上了，后续就不需要重复处理
                        break;
                    }
                }
                //根据是否有映射分别显示：已经匹配的则更新props.xxxx，否则更新关键属性上的xxx.xxxx
                var targetPropKey = property;//默认为采用标准属性上定义的propKey。注意：在建立标准属性时需要明确是文档属性，还是props.xxx扩展属性
                /**
                if(docKeys.indexOf(property)>0){ //检查property是否在json 的文档属性内，如果在则使用文档属性，否则认为是props下的扩展属性
                    targetPropKey = property; //使用原本的属性键值
                }
                //**/

                //检查默认值：对于数据值为空的情况优先设置默认值。禁用。当前defaultScore为单一数值，无法直接使用
                //注意：分别检查props.xxx 以及 非props.xxx
                if( /^props\./g.test(property) ){ //检查props.xxx
                    if( (!value || value.trim().length==0) && item.defaultValue && item.defaultValue.trim().length>0 ){ //数值为空，且有默认值
                        //先检查props.xxx 如果缺乏数值，则直接采用默认值填写
                        console.log("try set default value",value,item.defaultValue);
                        value = item.defaultValue; 
                        savePropValue(property, item.defaultValue, name);//同步提交保存
                    }
                }else{//检查非props.xxxx
                    if(Object.keys(docKeyValues).indexOf(property)>-1 && docKeyValues[property] && (""+docKeyValues[property]).trim().length > 0 ){ //优先从json的key-value pair中查询原来的数值
                        value = docKeyValues[property];
                        //已经是原来的值，不需要保存
                    }else if(item.defaultValue && item.defaultValue.trim().length>0 ){//如果kv键值对中没有，则检查是否有默认值，如果有则设置为默认值
                        value = item.defaultValue; 
                        savePropValue(property, item.defaultValue, name);//同步提交保存
                    }                    
                }

                //添加带自动补全功能HTML
                var propHtml = propHtmlTpl;
                var inputId = "propinput_"+targetPropKey.replace(/\./g,"_");
                if(item.labelType==="auto"){
                    propHtml = propHtml.replace(/__type/g,"number");//自动标注只能输入数字
                }else{
                    propHtml = propHtml.replace(/__type/g,"text");//否则自由输入
                }
                propHtml = propHtml.replace(/__propType/g,item.type=="self"?"๏":"○");
                propHtml = propHtml.replace(/__propName/g,name);
                propHtml = propHtml.replace(/__orgValue/g,value);
                if(item.tags&&item.tags.trim().length>0){ //优先显示数据提示
                    propHtml = propHtml.replace(/__placeholder/g,item.tags);
                }else if(item.description&&item.description.trim().length>0){ //其次显示属性描述
                    propHtml = propHtml.replace(/__placeholder/g,item.description);
                }else{
                    propHtml = propHtml.replace(/__placeholder/g,"补充数据评价更准确~~");
                }
                propHtml = propHtml.replace(/__property/g,property);
                propHtml = propHtml.replace(/__targetProperty/g,targetPropKey);
                propHtml = propHtml.replace(/__inputId/g,inputId);
                propHtml = propHtml.replace(/__labelType/g,item.labelType);
                propHtml = propHtml.replace(/__referDict/g,item.referDict);
                propHtml = propHtml.replace(/__referCategory/g,item.referCategory);
                propHtml = propHtml.replace(/__measureId/g,item.id);
                propHtml = propHtml.replace(/__style/g,"");
                $("#props").append(propHtml);
                //增加自动补全功能，需要根据标准属性定义进行区分：字典标注、引用标注、手动标注。对于自动标注或设置缺失的则不提供自动补全
                if(item.labelType === "dict" && item.referDict && item.referDict.trim().length>0){ //字典标注
                    console.log("enable dict autocomplete", name, property, item.referDict, stuff.meta.category, item);
                    $("#"+inputId).autocomplete({
                        source: function (request, response) {
                            console.log("dict autocomplete",$(this)[0].element.data("propname"),$(this)[0].element.data("referdict"));
                            //查询字典值作为自动补全:注意要采用已经写入的值
                            $.ajax({
                                url:app.config.sx_api+"/mod/dictValue/rest/search/"+$(this)[0].element.data("referdict"),
                                type:"post",
                                data:JSON.stringify({
                                    categoryId:stuff.meta.category, //注意要使用stuff的标注类目，而不是标注属性上的类目，因为有继承属性
                                    q: request.term,
                                    size: 10 //默认提示10条
                                }),
                                headers:{
                                    "Content-Type":"application/json"
                                },        
                                success:function(res){
                                    console.log("\n===got dict value suggestions ===\n",res);
                                    response(res.data);
                                }
                            });
                        },
                        change: function( evt, ui ) { //修改后更新数值并自动提交
                            //console.log("try save",evt.currentTarget.id,evt.currentTarget.dataset.targetproperty,evt.currentTarget.dataset.ovalue,$("#"+evt.currentTarget.id).val());
                            var oValue = evt.currentTarget.dataset.ovalue;
                            var nValue = $("#"+evt.currentTarget.id).val();
                            var pName = evt.currentTarget.dataset.propname;
                            if(ui.item && ui.item.value && ui.item.value.trim().length>0){ //从推荐列表中选择：实际上这里不会被触发
                                console.log("try save dict measure with suggestion",evt.currentTarget.id,evt.currentTarget.dataset.targetproperty,ui.item.value,$("#"+evt.currentTarget.id).val(),pName);
                                savePropValue(evt.currentTarget.dataset.targetproperty, ui.item.value, pName);//使用选择的数值
                            }else if(nValue != oValue){ //判断数值是否被修改：检测是否和原始值不同，如果不同则认为被修改
                                console.log("try save dict measure value",evt.currentTarget.id,evt.currentTarget.dataset.targetproperty,oValue, nValue, pName);
                                savePropValue(evt.currentTarget.dataset.targetproperty, nValue, pName);//使用手动输入的数值
                            }else{
                                console.log("no changes. ignore.");
                            }
                        },                        
                        minLength: 0 //不输入任何值也能自动提示
                    });
                }else if(item.labelType === "manual"){ //手动标注
                    console.log("enable performance autocomplete", name, property, stuff.meta.category, item);
                    $("#"+inputId).autocomplete({
                        source: function (request, response) {
                            console.log("performance autocomplete",$(this)[0].element.data("propname"),$(this)[0].element.data("measureid"));
                            //查询用户标注值作为自动补全
                            $.ajax({
                                url:app.config.sx_api+"/ope/performance/rest/search/"+$(this)[0].element.data("measureid"),
                                type:"post",
                                data:JSON.stringify({
                                    categoryId:stuff.meta.category, //注意要使用stuff的标注类目，而不是标注属性上的类目，因为有继承属性
                                    q: request.term,
                                    size: 10 //默认提示10条
                                }),
                                headers:{
                                    "Content-Type":"application/json"
                                },        
                                success:function(res){
                                    console.log("\n===got performance value suggestions ===\n",res);
                                    response(res.data);
                                }
                            });
                        },
                        change: function( evt, ui ) { //修改后更新数值并自动提交
                            //console.log("try save",evt.currentTarget.id,evt.currentTarget.dataset.targetproperty,evt.currentTarget.dataset.ovalue,$("#"+evt.currentTarget.id).val());
                            var oValue = evt.currentTarget.dataset.ovalue;
                            var nValue = $("#"+evt.currentTarget.id).val();
                            var pName = evt.currentTarget.dataset.propname;
                            if(ui.item && ui.item.value && ui.item.value.trim().length>0){ //从推荐列表中选择：实际上这里不会被触发
                                console.log("try save dict measure with suggestion",evt.currentTarget.id,evt.currentTarget.dataset.targetproperty,ui.item.value,$("#"+evt.currentTarget.id).val(), pName);
                                savePropValue(evt.currentTarget.dataset.targetproperty, ui.item.value, pName);//使用选择的数值
                            }else if(nValue != oValue){ //判断数值是否被修改：检测是否和原始值不同，如果不同则认为被修改
                                console.log("try save dict measure value",evt.currentTarget.id,evt.currentTarget.dataset.targetproperty,oValue, nValue, pName);
                                savePropValue(evt.currentTarget.dataset.targetproperty, nValue, pName);//使用手动输入的数值
                            }else{
                                console.log("no changes. ignore.");
                            }
                        },                        
                        minLength: 0 //不输入任何值也能自动提示
                    });
                }else if(item.labelType === "refer" && item.referCategory && item.referCategory.trim().length>0){ //引用标注
                    console.log("enable refer autocomplete", name, property, item.referCategory, stuff.meta.category, item);
                    $("#"+inputId).autocomplete({
                        source: function (request, response) {
                            console.log("refer autocomplete",$(this)[0].element.data("propname"),$(this)[0].element.data("refercategory"));
                            //查询引用值作为自动补全
                            $.ajax({
                                url:app.config.data_api + "/_api/cursor",
                                type:"post",
                                data:JSON.stringify({
                                    query: 'For doc in my_stuff filter doc.meta.category=="'+$(this)[0].element.data("refercategory")+'"  and doc.title like "%'+request.term+'%" limit 10 return doc.title',
                                    count: false
                                }),//注意：不能使用JSON对象
                                headers:{
                                    "Content-Type":"application/json",
                                    "Accept":"application/json",
                                    Authorization:"Basic aWxpZmU6aWxpZmU="
                                },        
                                success:function(res){ //直接返回title列表
                                    console.log("\n===got dict value suggestions ===\n",res);
                                    response(res);
                                }
                            });
                        },
                        change: function( evt, ui ) { //修改后更新数值并自动提交
                            //console.log("try save",evt.currentTarget.id,evt.currentTarget.dataset.targetproperty,evt.currentTarget.dataset.ovalue,$("#"+evt.currentTarget.id).val());
                            var oValue = evt.currentTarget.dataset.ovalue;
                            var nValue = $("#"+evt.currentTarget.id).val();
                            var pName = evt.currentTarget.dataset.propname;
                            if(ui.item && ui.item.value && ui.item.value.trim().length>0){ //从推荐列表中选择：实际上这里不会被触发
                                console.log("try save dict measure with suggestion",evt.currentTarget.id,evt.currentTarget.dataset.targetproperty,ui.item.value,$("#"+evt.currentTarget.id).val(), pName);
                                savePropValue(evt.currentTarget.dataset.targetproperty, ui.item.value, pName);//使用选择的数值
                            }else if(nValue != oValue){ //判断数值是否被修改：检测是否和原始值不同，如果不同则认为被修改
                                console.log("try save dict measure value",evt.currentTarget.id,evt.currentTarget.dataset.targetproperty,oValue, nValue, pName);
                                savePropValue(evt.currentTarget.dataset.targetproperty, nValue, pName);//使用手动输入的数值
                            }else{
                                console.log("no changes. ignore.");
                            }
                        },                        
                        minLength: 0 //不输入任何值也能自动提示
                    });
                }else{//设置存在缺失，如设置为字典标注，但未设置字典。或者 自动标注，不提供自动补全功能
                    console.log("no autocomplete", name, property, item.labelType, stuff.meta.category, item);
                    $("#"+inputId).autocomplete({
                        source: [""],
                        change: function( evt, ui ) { //修改后更新数值并自动提交
                            //console.log("try save",evt.currentTarget.id,evt.currentTarget.dataset.targetproperty,evt.currentTarget.dataset.ovalue,$("#"+evt.currentTarget.id).val());
                            var oValue = evt.currentTarget.dataset.ovalue;
                            var nValue = $("#"+evt.currentTarget.id).val();
                            var pName = evt.currentTarget.dataset.propname;
                            if(ui.item && ui.item.value && ui.item.value.trim().length>0){ //从推荐列表中选择：实际上这里不会被触发
                                console.log("try save measure with suggestion",evt.currentTarget.id,evt.currentTarget.dataset.targetproperty,ui.item.value,$("#"+evt.currentTarget.id).val(),nValue, pName);
                                savePropValue(evt.currentTarget.dataset.targetproperty, ui.item.value, pName);//使用选择的数值
                            }else if(nValue != oValue){ //判断数值是否被修改：检测是否和原始值不同，如果不同则认为被修改
                                console.log("try save measure value",evt.currentTarget.id,evt.currentTarget.dataset.targetproperty,oValue, nValue, pName);
                                savePropValue(evt.currentTarget.dataset.targetproperty, nValue, pName);//使用手动输入的数值
                            }else{
                                console.log("no changes. ignore.");
                            }
                        },                          
                        minLength: 20 //不提供自动提示
                    });
                }
              }
              //添加未出现在标准类目映射中的property，即当前商品props中独有的属性。不提供自动补全。修改直接针对 props.xxx 进行
                for(j in props){
                    var prop = props[j];
                    if(_sxdebug)console.log("un matched prop:"+JSON.stringify(prop));
                    var property = Object.keys(prop)[0];
                    var value = prop[property];
                    var name = property ;//默认属性名称和属性的key一致

                    //可以严格控制不允许文本属性出现：如 price.currency 应该出现在采集文本内，而不是props属性下。否则会被分析系统认为是新的待标注属性
                    /**
                    if(docKeys.indexOf(property)>-1) //可以严格控制不允许文本属性出现：当前忽略
                        continue;       
                    //**/

                    var targetPropKey = "props."+property;//尚未在标准属性中定义的都认为是props.xxx扩展属性
                    
                    //添加带自动补全功能HTML
                    var propHtml = propHtmlTpl;
                    var inputId = "propinput_"+targetPropKey.replace(/\./g,"_");
                    propHtml = propHtml.replace(/__type/g,"text");//否则自由输入
                    propHtml = propHtml.replace(/__propType/g,"&nbsp");//无显示前缀
                    propHtml = propHtml.replace(/__propName/g,name);
                    propHtml = propHtml.replace(/__orgValue/g,value);
                    propHtml = propHtml.replace(/__property/g,property);
                    propHtml = propHtml.replace(/__targetProperty/g,targetPropKey);
                    propHtml = propHtml.replace(/__inputId/g,inputId);
                    propHtml = propHtml.replace(/__labelType/g,"");
                    propHtml = propHtml.replace(/__referDict/g,"");
                    propHtml = propHtml.replace(/__referCategory/g,"");
                    propHtml = propHtml.replace(/__measureId/g,"");
                    propHtml = propHtml.replace(/__style/g,"border-color:red;");
                    $("#propsList").append(propHtml);

                    console.log("ext prop item.", name, property, targetPropKey);
                    $("#"+inputId).autocomplete({
                        source: [""],
                        change: function( evt, ui ) { //修改后更新数值并自动提交
                            //console.log("try save",evt.currentTarget.id,evt.currentTarget.dataset.targetproperty,evt.currentTarget.dataset.ovalue,$("#"+evt.currentTarget.id).val());
                            var oValue = evt.currentTarget.dataset.ovalue;
                            var nValue = $("#"+evt.currentTarget.id).val();
                            var pName = evt.currentTarget.dataset.propname;
                            if(ui.item && ui.item.value && ui.item.value.trim().length>0){ //从推荐列表中选择：实际上这里不会被触发
                                console.log("try save ext prop value with suggestion",evt.currentTarget.id,evt.currentTarget.dataset.targetproperty,ui.item.value,$("#"+evt.currentTarget.id).val(),nValue,pName);
                                savePropValue(evt.currentTarget.dataset.targetproperty, ui.item.value, pName);//使用选择的数值
                            }else if(nValue != oValue){ //判断数值是否被修改：检测是否和原始值不同，如果不同则认为被修改
                                console.log("try save ext prop value",evt.currentTarget.id,evt.currentTarget.dataset.targetproperty,oValue, nValue, pName);
                                savePropValue(evt.currentTarget.dataset.targetproperty, nValue, pName);//使用手动输入的数值
                            }else{
                                console.log("no changes. ignore.");
                            }
                        },                          
                        minLength: 20 //不提供自动提示
                    });
                }
              if(_sxdebug)console.log("prop Nodes:"+JSON.stringify(nodes));  

            //显示属性列表
            $("#propsDiv").css("display","block");    

        }
    })     
}

//保存属性值：直接更新stuff对象。对于props对象更新时，需要同步清理doc属性，对于doc属性，需要同步删除props属性
function savePropValue(fullProperty, nValue, pName){
    console.log("try update stuff.",fullProperty,nValue,pName,JSON.parse(JSON.stringify(stuff)));
    var propChain = fullProperty.split(".");
    console.log("got parsed property", propChain, nValue, pName);
    var pattern = /props\./g;
    if(pattern.test(fullProperty)){ //是props下的扩展属性，更新props，并同步清理文档上的同key或同name属性
        if(!stuff.props)
            stuff.props = {};
        stuff.props[propChain[propChain.length-1]] = nValue;
        delete stuff[propChain[propChain.length-1]];
        delete stuff[pName];
    }else{//是文档上的非props属性。需要更新，并且清理props下的属性。注意可能有多层，需要遍历
        if(propChain.length ==1){
            stuff[propChain[0]] = nValue;
        }else if(propChain.length ==2){
            if(!stuff[propChain[0]])
                stuff[propChain[0]] = {};
            stuff[propChain[0]][propChain[1]] = nValue;
        }else if(propChain.length ==3){
            if(!stuff[propChain[0]])
                stuff[propChain[0]] = {};
            if(!stuff[propChain[0]][propChain[1]])
                stuff[propChain[0]][propChain[1]] = {};
            stuff[propChain[0]][propChain[1]][propChain[2]] = nValue;
        }else{
            console.log("property hierarchy must be 1-3.");
        }
        //删除props内的同名属性，只考虑一级
        if(stuff.props){
            delete stuff.props[fullProperty];
            delete stuff.props[pName];
        }
        
    }

    //提交保存：有延后，避免频繁提交
    commitData(stuff, false,function(){
        console.log("data saved.");
    });
    console.log("stuff propvalue updated.",stuff);
}

/**
//@deprecated 原始版本
//根据ItemCategory类别，获取对应的属性配置，并与数据值融合显示
//0，获取property mapping，采用同步方式。获取后作为属性比对。根据name或者props.name对照
//1，根据key进行合并显示，以itemCategory下的属性为主，能够对应上的key显示绿色，否则显示红色
//2，数据显示，有对应于key的数值则直接显示，否则留空等待填写
function loadProps(categoryId){
    //同步获取propertyMapping：根据source、category（注意是原始类目名称，不是标准类目）、name（name或者props.name）查找
    var propMapping = {};
    $.ajax({
        url:"https://data.shouxinjk.net/_db/sea/property/platform_properties/get-mapping",
        type:"post",
        async: false,//同步调用
        data:JSON.stringify({
            source:currentItem.source,
            category:currentItem.category
        }),
        success:function(result){
            if(_sxdebug)console.log(result);
            result.data.forEach((item, index) => {//将其他元素加入
              if(_sxdebug)console.log("foreach props.[index]"+index,item);
              propMapping[item.name.replace(/\./g,"_")]=item.mappingName;
            });   
            console.log("got property mapping.",propMapping);         
        }
    });
    //根据categoryId获取所有measure清单，字段包括name、property
    $.ajax({
        url:"https://data.shouxinjk.net/ilife/a/mod/measure/measures?category="+categoryId,
        type:"get",
        data:{},
        success:function(items){
            if(_sxdebug)console.log(items);
            //在回调内：1，根据返回结果组装待展示数据，字段包括：name、property、value、flag(如果在则为0，不在为1)
            var props = currentItem.props?currentItem.props:[];//临时记录当前stuff的属性列表
              nodes = [];
              for( k in items ){
                var item = items[k];
                if(_sxdebug)console.log("measure:"+JSON.stringify(item));
                var name=item.name;
                var property = item.property;
                var value = props[property]?props[property]:"";
                for(j in props){
                    var prop = props[j];
                    var _key = "";
                    for ( var key in prop){//从prop内获取key
                        _key = key;
                        break;
                    }  
                    if(_key===property){//如果存在对应property：这是理想情况，多数情况下都只能通过name匹配
                        value = prop[_key];
                        props.splice(j, 1);//删除该元素
                        break;
                    }else if(_key===name){//如果匹配上name 也进行同样的处理
                        value = prop[_key];
                        props.splice(j, 1);//删除该元素
                        break;
                    }else if(propMapping[_key]===name || propMapping["props_"+_key]===name || propMapping[_key.replace(/\./g,"_")]===name){//从prop mapping中进行匹配，采用name，或者props_name进行查找
                        value = prop[_key];
                        props.splice(j, 1);//删除该元素
                        break;                        
                    }
                }
                var node = {
                    "name" :  name,
                    "property":property,
                    "value":value,
                    //"flag":true
                }
                nodes.push( node );
              }
              //添加未出现的property
                for(j in props){
                    var prop = props[j];
                    if(_sxdebug)console.log("un matched prop:"+JSON.stringify(prop));
                    var property="";
                    var value = "";
                    for (var key in prop){
                        property = key;
                        value = prop[key];
                        break;
                    }                   
                    var node = {
                        "name" :  property,//属性名直接作为显示名称
                        "property":property,
                        "value":value,
                        //"flag":false
                    }
                    nodes.push( node );
                }
              if(_sxdebug)console.log("prop Nodes:"+JSON.stringify(nodes));
              //return data;            
            //在回调内：2，组装并显示数据表格
            $("#propsList").jsGrid({
                width: "100%",
                //height: "400px",
         
                inserting: false,
                editing: true,
                sorting: false,
                paging: false,
                onItemInserted:function(row){
                    if(_sxdebug)console.log("item inserted",row);
                    //更新到当前修改item属性列表内
                    if(!currentItem.props)
                        currentItem.props = [];
                    //由于采用的是键值对，需要进行遍历。考虑到浏览器影响，此处未采用ES6 Map对象
                    var props = [];//新建一个数组
                    var prop = {};
                    prop[row.item.name] = row.item.value;//直接更新对应属性数值：注意，此处采用name更新，与页面采集器保持一致  
                    props.push(prop);
                    currentItem.props.forEach((item, index) => {//将其他元素加入
                      if(_sxdebug)console.log("foreach props.[index]"+index,item);
                      if(!item[row.item.name])
                        props.push(item);
                    });
                    currentItem.props = props;
                    if(_sxdebug)console.log("item props updated",currentItem);                 
                },
                onItemUpdated:function(row){
                    if(_sxdebug)console.log("item updated",row);
                    if(!currentItem.props)
                        currentItem.props = [];                    
                    //由于采用的是键值对，需要进行遍历。考虑到浏览器影响，此处未采用ES6 Map对象
                    var props = [];//新建一个数组
                    var prop = {};
                    prop[row.item.name] = row.item.value;//直接更新对应属性数值：注意，此处采用name更新，与页面采集器保持一致  
                    props.push(prop);
                    currentItem.props.forEach((item, index) => {//将其他元素加入
                      if(_sxdebug)console.log("foreach props.[index]"+index,item);
                      if(!item[row.item.name])
                        props.push(item);                      
                    });
                    currentItem.props = props; 
                    if(_sxdebug)console.log("item props updated",currentItem);   
                },

                data: nodes,
         
                fields: [
                    {title:"名称", name: "name", type: "text", width: 100 },
                    //{title:"属性", name: "property", type: "text", width: 50 },
                    {title:"数值", name: "value", type: "text",width:200},
                    //{ name: "Matched", type: "checkbox", title: "Is Matched", sorting: false },
                    { type: "control" ,editButton: true,deleteButton: false,   width: 50}
                ]
            });   
            //显示属性列表
            $("#propsDiv").css("display","block");          
        }
    })     
}
//**/

//加载用户行为，作为买家说行为记录：
//统计指定行为数量：
function loadCountByAction(actionType) {
    console.log("Feed::loadActionSum");
    //设置query
    var esQuery = {//搜索控制
      from: 0,
      size: 10,//数量不关注，仅处理结果中的总记录数即可
      query: {
        bool: {
          must: [
            {
              "match": {
                "itemId": stuff._key
              }
            },
            {
              "match": {
                "action": actionType
              }
            }            
          ]
        }
      },/*
      collapse: {
        field: "userId"//根据userId 折叠，即：一个user仅显示一次
      },//*/
      sort: [
        //{ "weight": { order: "desc" } },//权重高的优先显示
        { "@timestamp": { order: "desc" } },//最近操作的优先显示
        { "_score": { order: "desc" } }//匹配高的优先显示
      ]
    };

    //设置请求头
    var esHeader = {
      "Content-Type": "application/json",
      "Authorization": "Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
    };

    $.ajax({
        url:"https://data.pcitech.cn/actions/_search",
        type:"post",
        data:JSON.stringify(esQuery),//注意：nginx启用CORS配置后不能直接通过JSON对象传值
        headers:{
            "Content-Type":"application/json",
            "Authorization":"Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
        },
        crossDomain: true,
        timeout:3000,//设置超时
        success:function(data){
            console.log("Feed::loadData success.",data);
            if(data.hits.total == 0 ){
                //do nothing
            }else{
                //更新操作数量
                updateActionCount(actionType,data.hits.total);
            }
        }
    });
  }

//加载用户浏览数据：根据选定用户显示其浏览历史，对于画像则显示该画像下的聚集数据
//currentPersonType: person则显示指定用户的记录，persona显示该画像下所有记录
function loadData() {
    console.log("Feed::loadData");
    //设置query
    var esQuery = {//搜索控制
      from: (page.current + 1) * page.size,
      size: page.size,
      query: {
        bool: {
          must: [
            {
              "match": {
                "itemId": stuff._key
              }
            }
          ]
        }
      },//*
      collapse: {
        field: "userId"//根据userId 折叠，即：一个user仅显示一次
      },//*/
      sort: [
        //{ "weight": { order: "desc" } },//权重高的优先显示
        { "@timestamp": { order: "desc" } },//最近操作的优先显示
        { "_score": { order: "desc" } }//匹配高的优先显示
      ]
    };

    //设置请求头
    var esHeader = {
      "Content-Type": "application/json",
      "Authorization": "Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
    };

    $.ajax({
        url:"https://data.pcitech.cn/actions/_search",
        type:"post",
        data:JSON.stringify(esQuery),//注意：nginx启用CORS配置后不能直接通过JSON对象传值
        headers:{
            "Content-Type":"application/json",
            "Authorization":"Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
        },
        crossDomain: true,
        timeout:3000,//设置超时
        success:function(data){
            console.log("Feed::loadData success.",data);
            if(data.hits.total == 0 || data.hits.hits.length==0){//如果没有内容，则显示提示文字
                shownomore(true);
                showloading(false);
            }else{
                //更新总页数
                var total = data.hits.total;
                page.total = (total + page.size - 1) / page.size;
                //更新当前翻页
                page.current = page.current + 1;
                //装载具体条目
                var hits = data.hits.hits;
                for(var i = 0 ; i < hits.length ; i++){
                    //items.push(hits[i]._source.item);
                    items.push(hits[i]._source);
                }
                insertItem();
                showloading(false);
            }
        },
        complete: function (XMLHttpRequest, textStatus) {//调用执行后调用的函数
            if(textStatus == 'timeout'){//如果是超时，则显示更多按钮
              console.log("ajax超时",textStatus);
              shownomore(true);
            }
        },
        error: function () {//调用出错执行的函数
            //请求出错处理：超时则直接显示搜索更多按钮
            shownomore(true);
          }
    });
  }

//加载feeds
function loadFeeds(){
    setInterval(function ()
    {
        //console.log("interval",$(window).scrollTop(),$(document).height(),$(window).height(),$(document).height() - $(window).height() - dist);
        if ($(window).scrollTop() >= $(document).height() - $(window).height() - dist && !loading)
        {
            // 表示开始加载
            loading = true;

            // 加载内容
            if(items.length < num){//如果内容未获取到本地则继续获取
                //console.log("load from remote ");
                loadData();
            }else{//否则使用本地内容填充
                //console.log("load from locale ");
                insertItem();
            }
        }
    }, 60);
}  

//将feed item显示到页面
function insertItem(){
    // 加载历史行为
    var actionItem = items[num-1];
    //检查是否还有，如果没有则显示已完成
    if(!actionItem){
      shownomore(true);
      return;
    }
    //隐藏no-more-tips
    $("#no-results-tip").toggleClass("no-result-tip-hide",true);
    $("#no-results-tip").toggleClass("no-result-tip-show",false); 

    // 加载内容：显示用户及行为列表
      var html = "";
      html += "<div class='action-item'>";
      html += "<div class='action-person-logo'><img src='"+(actionItem.user&&actionItem.user.avatarUrl?actionItem.user.avatarUrl:currentPerson.avatarUrl)+"' width='40px' height='40px'/></div>";//logo
      html += "<div class='action-info'>";
      html += "<div class='action-person-name'>"+(actionItem.user&&actionItem.user.nickName?actionItem.user.nickName:currentPerson.nickName)+"</div>";//name
      html += "<div class='action-person-type'>"+(actionTypes[actionItem.action]?actionTypes[actionItem.action]:actionItem.action)+"</div>";//action
      html += "<div class='action-person-time'>"+getDateDiff(actionItem.timestamp)+"</div>";//time
      html += "</div>";
      html += "</div>";
    $("#waterfall").append("<li><div class='feed-separator' style='border-radius:0'></div>"+html+"</li>");
    num++;

    //注册事件
    if(actionItem.user&&actionItem.user._key){
        $("div[data='"+actionItem.user._key+"']").click(function(){
            //跳转到详情页面
            window.location.href = "feeds.html?id="+actionItem.user._key;
        });
    }

    // 表示加载结束
    showloading(false);
    loading = false;    
    num++;  
}

//统计用户行为数量，并更新界面显示
function updateActionCount(actionType,count){
    //判断行为类型后计数+1
    var countKey = actionTypeConvert[actionType];
    actionCounts[countKey] = actionCounts[countKey]+count;
    totalActions = totalActions+count;
    showUserActions();
}

function showUserActions(){
    $("#user-actions").empty();//先把已有内容清空掉
    if(totalActions>0){//如果啥行为都没有就别展示了
        var html = "<div class='prop-row'><div class='prop-key'>用户热度</div><div class='prop-value user-actions'>";
        for (var key in actionCounts){
            var count = actionCounts[key];
            if(key && count >0 )
                html += "<div class='user-actions-number user-actions-number-"+key+"'>"+" "+count+"</div>";
        }                   
        html += "</div></div>";
        $("#user-actions").append(html);
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

//显示没有更多内容
function shownomore(flag){
  //检查是否是一条数据都没加载
  if(items.length==0){//需要特别处理：如果没有任何数据，则需要默认设置，否则导致无法显示show more btn
    $("#waterfall").height(10);
    $("#no-results-tip").toggleClass("no-result-tip-hide",false);
    $("#no-results-tip").toggleClass("no-result-tip-show",true);
  }    
  if(flag){
    $("#findMoreBtn").toggleClass("findMoreBtn-hide",false);
    $("#findMoreBtn").toggleClass("findMoreBtn-show",true);   
  }else{
    $("#findMoreBtn").toggleClass("findMoreBtn-hide",true);
    $("#findMoreBtn").toggleClass("findMoreBtn-show",false);
  }
}

// 时间戳转多少分钟之前
function getDateDiff(dateTimeStamp) {
    // 时间字符串转时间戳
    var timestamp = new Date(dateTimeStamp).getTime();
    var minute = 1000 * 60;
    var hour = minute * 60;
    var day = hour * 24;
    var halfamonth = day * 15;
    var month = day * 30;
    var year = day * 365;
    var now = new Date().getTime();
    var diffValue = now - timestamp;
    var result;
    if (diffValue < 0) {
        return;
    }
    var yearC = diffValue / year;
    var monthC = diffValue / month;
    var weekC = diffValue / (7 * day);
    var dayC = diffValue / day;
    var hourC = diffValue / hour;
    var minC = diffValue / minute;
    if (yearC >= 1) {
        result = "" + parseInt(yearC) + "年前";
    } else if (monthC >= 1) {
        result = "" + parseInt(monthC) + "月前";
    } else if (weekC >= 1) {
        result = "" + parseInt(weekC) + "周前";
    } else if (dayC >= 1) {
        result = "" + parseInt(dayC) + "天前";
    } else if (hourC >= 1) {
        result = "" + parseInt(hourC) + "小时前";
    } else if (minC >= 1) {
        result = "" + parseInt(minC) + "分钟前";
    } else
        result = "刚刚";
    return result;
}

//装载菜单：如果为未关注用户则引导授权，否则直接跳转
var sxMenu = { //4个底部菜单，key为菜单id，value为html名，和state一致
    index:"index",
    measures:"measures",
    proposals:"proposals",
    my:"user"
    };
var sxMenuWechatTpl = "https://open.weixin.qq.com/connect/oauth2/authorize?appid=wxe12f24bb8146b774&redirect_uri=https://www.biglistoflittlethings.com/ilife-web-wx/dispatch.html&response_type=code&scope=snsapi_userinfo&state=__state__#wechat_redirect";
function showSxMenu(){
    if(app.globalData.userInfo && app.globalData.userInfo._key){ 
        console.log("user has subscribed. use default menu.");
    }else{
        console.log("new user. build wechat menu.");
        Object.keys(sxMenu).forEach(function(menu){
            var href = sxMenuWechatTpl.replace(/__state__/g,sxMenu[menu]);
            console.log("assemble menu href.",href);
            $("#sx-menu-"+menu).attr("href",href);
        });

    }
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
    //var shareUrl = window.location.href.replace(/info2/g,"share");//需要使用中间页进行跳转
    var shareUrl = window.location.href.replace(/info2/g,"go");//通过中间页直接跳转到第三方电商详情页面
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
                //准备分享的描述：优先采用推荐语、其次tagging、再次tags
                var advice = "大大小小的选择构成了我们的生活，挑选适合自己的才是最好的。";
                if(stuff.advice && Object.keys(stuff.advice).length>0 ){//如果有advice，则随机采用
                    var count = Object.keys(stuff.advice).length;
                    var random = 0;//默认采用第一条
                    if(count>1){//如果是多个则随机采用
                        random = new Date().getTime()%count;
                    }
                    advice = stuff.advice[Object.keys(stuff.advice)[random]];
                }else if(stuff.tagging&&stuff.tagging.trim().length>0){//否则采用tagging
                    advice = stuff.tagging;
                }else if(stuff.tags&&stuff.tags.length>0){//最后采用tags
                    advice = stuff.tags.join(" ");
                }else{
                    //采用默认值
                }                
                //分享到朋友圈
                wx.onMenuShareTimeline({
                    title:"确幸推荐·"+(stuff?stuff.title:"你的生活助手"), // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:stuff?stuff.images[0].replace(/\.avif/,''):"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(11)+".jpeg", // 分享图标
                    success: function () {
                        // 用户点击了分享后执行的回调函数
                        logstash(stuff,"mp","share timeline",shareUserId,shareBrokerId,function(res){
                            console.log("分享到朋友圈",res);
                        }); 
                    },
                });
                //分享给朋友
                wx.onMenuShareAppMessage({
                    title:"确幸推荐·"+(stuff?stuff.title:"你的生活助手"), // 分享标题
                    desc:advice, // 分享描述
                    //desc:stuff&&stuff.tags?stuff.tags.join(" "):"Live is all about having a good time.", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: stuff?stuff.images[0].replace(/\.avif/,''):"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(11)+".jpeg", // 分享图标
                    type: 'link', // 分享类型,music、video或link，不填默认为link
                    dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
                    success: function () {
                      // 用户点击了分享后执行的回调函数
                        logstash(stuff,"mp","share appmsg",shareUserId,shareBrokerId,function(res){
                            console.log("分享到微信",res);
                        }); 
                    }
                });  

                //分享到朋友圈
                wx.updateTimelineShareData({
                    title:"确幸推荐·"+(stuff?stuff.title:"你的生活助手"), // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:stuff?stuff.images[0].replace(/\.avif/,''):"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(11)+".jpeg", // 分享图标
                    success: function () {
                        // 用户点击了分享后执行的回调函数
                        logstash(stuff,"mp","share timeline",shareUserId,shareBrokerId,function(res){
                            console.log("分享到朋友圈",res);
                        }); 
                    },
                });
                //分享给朋友
                wx.updateAppMessageShareData({
                    title:"确幸推荐·"+(stuff?stuff.title:"你的生活助手"), // 分享标题
                    desc:advice, // 分享描述
                    //desc:stuff&&stuff.tags?stuff.tags.join(" "):"Live is all about having a good time.", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: stuff?stuff.images[0].replace(/\.avif/,''):"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(11)+".jpeg", // 分享图标
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
                    desc:advice, // 分享描述
                    //desc:stuff&&stuff.tags?stuff.tags.join(" "):"Live is all about having a good time.", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: stuff?stuff.images[0].replace(/\.avif/,''):"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(11)+".jpeg", // 分享图标
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
