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
    category = args["category"]?args["category"]:0; //如果是跳转，需要获取当前目录
    tagging = args["keyword"]?args["keyword"]:""; //通过搜索跳转
    filter = args["filter"]?args["filter"]:""; //根据指定类型进行过滤
    articleType = args["articleType"]?args["articleType"]:"";//物料类别
    if(args["categoryTagging"])categoryTagging=args["categoryTagging"];
    if(args["personTagging"])personTagging=args["personTagging"];
    if(tagging.trim().length>0){
        $(".search input").attr("placeholder","🔍 "+tagging);
    }
    loadCategories(category);//加载导航目录
    $("#searchBtn").click(function(event){//注册搜索事件
        tagging = $(".search input").val().trim();
        if(tagging.length>1){
            window.location.href="index.html?keyword="+tagging;
        }else{
            console.log("do nothing because there is no input text.");
        }
    });

    $("#findAll").click(function(){//注册搜索事件：点击搜索全部
        tagging = $(".search input").val().trim();
        //window.location.href="index.html?keyword="+tagging;
        loadData();
    });

    $("body").css("background-color","#fff");//更改body背景为白色

    //加载达人信息
    loadBrokerInfo();

    //loadPerson(currentPerson);//加载用户
    if(app.globalData.userInfo&&app.globalData.userInfo._key){//如果本地已有用户则直接加载
        loadPerson(currentPerson);//加载用户
    }else{//否则显示二维码
        showWxQrcode();
        //显示数据填报表单
        $.blockUI({ message: $('#bindQrcodeform'),
            css:{ 
                padding:        10, 
                margin:         0, 
                width:          '80%', 
                top:            '30%', 
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

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });
    
    //取消充值
    $("#btnCancelCharge").click(function(e){
        $.unblockUI(); 
    });  

    //注册切换到 阅TA 
    $("#item").click(function(e){
        window.location.href = "material.html?articleType=item";
    });
    $("#board").click(function(e){
        window.location.href = "material.html?articleType=board";
    });   
    //根据filter切换界面高亮显示
    if(articleType=="item"){
        $("#item").removeClass("filter");
        $("#item").addClass("filter-selected");
        $("#board").removeClass("filter-selected");
        $("#board").addClass("filter");     
    }else{
        $("#board").removeClass("filter");
        $("#board").addClass("filter-selected");
        $("#item").removeClass("filter-selected");
        $("#item").addClass("filter"); 
    }

    //注册分享事件
    registerShareHandler();  

});

util.getUserInfo();//从本地加载cookie

var byOpenid = null;
var byPublisherOpenid = null;

var instSubscribeTicket = null;//对于即时关注，需要缓存ticket
var groupingCode = null;//班车code：默认自动生成
var timeFrom = new Date().getTime();//班车开始时间:long，默认为当前时间
var timeTo = timeFrom+60*60*1000;//班车结束时间:long，默认持续一个小时

var articleType = "item";//文章类别：默认为item

//设置默认logo
var logo = "https://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg";
var currentPersonJson = {};//当前用户明细

var columnWidth = 800;//默认宽度600px
var columnMargin = 5;//默认留白5px
var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var category  = 0; //当前目录ID
var tagging = ""; //当前目录关联的查询关键词，搜索时直接通过该字段而不是category进行
var filter = "";//数据查询规则：默认为查询全部
var categoryTagging = "";//记录目录切换标签，tagging = categoryTagging + currentPersonTagging

var items = [];//所有物料列表
var itemKeys = [];//物料key列表

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


//请求qrcode并显示二维码，供达人扫码绑定
function showWxQrcode(){
    //检查缓存是否有ticket
    var instTicketInfo = $.cookie('sxInstTicket');
    console.log("load instTicketInfo from cookie.",instTicketInfo);
    if(instTicketInfo && instTicketInfo.trim().length>0){//有缓存，表示是已经扫码后返回，直接显示二维码并查询即可
        var instTicket = JSON.parse(instTicketInfo.trim());
        //显示二维码
        $("#wxQrcodeDiv").html("<img width='240' src='"+instTicket.url+"' style='display:block;margin:0 auto;'/>");
        //开始轮询扫码结果
        setInterval(function ()
        {
          getQrcodeScanResult(instTicket.ticket);//实际是6位短码               
        }, 500);            
    }else{//否则表示初次进入，直接请求新的二维码
        $.ajax({
            url:app.config.auth_api+"/wechat/ilife/inst-qrcode",
            type:"get",
            data:{
                code:groupingCode  //默认传递班车编码
            },
            success:function(res){
                console.log("got qrcode and redirect.",res);
                //显示二维码
                $("#wxQrcodeDiv").html("<img width='240' src='"+res.url+"' style='display:block;margin:0 auto;'/>");
                //将ticket缓存，在完成关注后返回还能继续查询
                var expDate = new Date();
                expDate.setTime(expDate.getTime() + (5 * 60 * 1000)); // 5分钟后自动失效：避免用户进入关注界面超时不回来    
                console.log("Publisher::Articles-grouping save inst ticket to cookie.",res);
                $.cookie('sxInstTicket', JSON.stringify(res), { expires: expDate, path: '/' });  //再返回时便于检查  
                //根据返回的短码，生成链接，便于从公众号关注后的模板消息进入
                var state = "publisher__material___fromBroker="+broker.id;
                var longUrl = "https://open.weixin.qq.com/connect/oauth2/authorize?appid=wxe12f24bb8146b774&redirect_uri=https://www.biglistoflittlethings.com/ilife-web-wx/dispatch.html&response_type=code&scope=snsapi_userinfo&state=";
                longUrl += state;
                longUrl += "#wechat_redirect";
                saveShortCode(hex_md5(longUrl),"page_"+res.ticket,"","","mp",encodeURIComponent(longUrl),res.ticket);             
                //开始轮询扫码结果
                setInterval(function ()
                {
                  getQrcodeScanResult(res.ticket);//实际是6位短码               
                }, 500);
                //**/
            }
        });
    }
}

//查询扫码结果，将返回openid
function getQrcodeScanResult(ticket){
    console.log("try to query scan result by uuid.",ticket);
    $.ajax({
        url:app.config.auth_api+"/wechat/ilife/bind-openid?uuid="+ticket,//根据短码查询关注结果
        type:"get",
        data:{},
        success:function(res){
            console.log("got qrcode scan result.",res);
            if(res.status && res.openid){//成功扫码，刷新页面：需要通过微信授权页面做一次跳转，要不然无法获取用户信息
                var state = "publisher__material___fromBroker="+broker.id;
                //https://open.weixin.qq.com/connect/oauth2/authorize?appid=wxe12f24bb8146b774&redirect_uri=https://www.biglistoflittlethings.com/ilife-web-wx/dispatch.html&response_type=code&scope=snsapi_userinfo&state=index#wechat_redirect
                var targetUrl = "https://open.weixin.qq.com/connect/oauth2/authorize?appid=wxe12f24bb8146b774&redirect_uri=https://www.biglistoflittlethings.com/ilife-web-wx/dispatch.html&response_type=code&scope=snsapi_userinfo&state=";
                targetUrl += state;
                targetUrl += "#wechat_redirect";
                window.location.href = targetUrl;          
            }
        }
    });
}


//优先从cookie加载达人信息
function loadBrokerInfo(){
  broker = util.getBrokerInfo();
  currentBroker = broker.id;
  console.log("loadBrokerInfo got result.",broker,currentBroker);
}

//开始查询数据
function startQueryDataLoop(){
    setInterval(function ()
    {
        if ($(window).scrollTop() >= $(document).height() - $(window).height() - dist && !loading)
        {
            // 表示开始加载
            loading = true;

            // 加载内容
            if(items.length < num){//如果内容未获取到本地则继续获取
                loadItems();
            }else{//否则使用本地内容填充
                insertItem();
            }
        }
    }, 60);  
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

var esQueryTemplate = JSON.stringify({
  "from": 0,
  "size": page.size,    
  "query":{
    "bool":{
      "must": [

      ],       
      "must_not": [],                
      "filter": [],      
      "should":[
        //默认：必须显示type是单品的内容
        //{"match" : {"type": "item"}}
      ]
    }
  },
  "sort": [
  /*
    { "_score":   { "order": "desc" }},
    { "@timestamp": { "order": "desc" }}
    //**/
  ]   
});

var taggingBoolQueryTextTemplate = JSON.stringify({"match" : {"full_text": ""}});//在full_text字段搜索
var taggingBoolQueryTagsTemplate = JSON.stringify({"match" : {"full_tags": ""}});//在full_tags字段搜索
var taggingBoolQueryShouldTemplate = JSON.stringify({
    "bool" : {
           "should" : [],
          "minimum_should_match": 1
          }
     });

var sortByScore = { "_score":   { "order": "desc" }};
var sortByTimestamp = { "timestamp":   { "order": "desc" }};

var sortByPrice = { "price.sale":   { "nested_path" : "price","order": "asc" }};
var sortByRank = { "rank.score":   { "nested_path" : "rank","order": "desc" }};
var sortByProfit = { "profit.order":   { "nested_path" : "profit","order": "desc" }};

//组建 手动输入/用户标注/目录标注 查询。将加入MUST查询
function buildTaggingQuery(keyword){
    var q = JSON.parse(taggingBoolQueryShouldTemplate);
    //组织full_text查询
    var textTerm = JSON.parse(taggingBoolQueryTextTemplate);
    textTerm.match.full_text = keyword;
    q.bool.should.push(textTerm);
    //组织full_tags查询
    /*
    var textTags = JSON.parse(taggingBoolQueryTagsTemplate);
    textTags.match.full_tags = keyword;
    q.bool.should.push(textTags);
    //**/
    //返回组织好的bool查询
    return q;
}

function buildEsQuery(){
    var complexQuery = JSON.parse(esQueryTemplate);
    //添加must
    if(tagging && tagging.trim().length > 0){//手动输入搜索条件
        complexQuery.query.bool.must.push(buildTaggingQuery(tagging));
    }
    if(currentPersonTagging && currentPersonTagging.trim().length > 0){//用户或画像标注
        complexQuery.query.bool.must.push(buildTaggingQuery(currentPersonTagging));
    }
    if(categoryTagging && categoryTagging.trim().length > 0){//目录标注
        complexQuery.query.bool.must.push(buildTaggingQuery(categoryTagging));
    }    
    //TODO：添加must_not
    /*
    if(userInfo.tagging && userInfo.tagging.must_not){
        complexQuery.query.bool.must_not.push({match: { full_tags: userInfo.tagging.must_not.join(" ")}});
    }else if(persona.tagging && persona.tagging.must_not){
        complexQuery.query.bool.must_not.push({match: { full_tags: persona.tagging.must_not.join(" ")}});
    }else{
        console.log("no must_not");
    }*/
    //TODO：添加filter
    /*
    if(userInfo.tagging && userInfo.tagging.filter){
        complexQuery.query.bool.filter.push({match: { full_tags: userInfo.tagging.filter.join(" ")}});
    }else if(persona.tagging && persona.tagging.filter){
        complexQuery.query.bool.filter.push({match: { full_tags: persona.tagging.filter.join(" ")}});
    }else{
        console.log("no filter");
    }*/

    //添加排序规则：byRank/byPrice/byProfit/byDistance
    if(filter && filter.trim()=="byPrice"){//根据价格排序
        complexQuery.query.bool.should.push(funcQueryByPrice);
        //complexQuery.sort.push(sortByPrice);
    }else if(filter && filter.trim()=="byDistance"){//根据位置进行搜索。优先从用户信息中获取经纬度，否则请求获取得到当前用户经纬度
        //TODO 需要使用当前选中的用户进行设置：如果选中的是画像怎么办？？
        funcQueryByDistance.function_score.functions[0].gauss.location.origin.lat = app.globalData.userInfo.location.latitude;
        funcQueryByDistance.function_score.functions[0].gauss.location.origin.lon = app.globalData.userInfo.location.longitude;
        complexQuery.query.bool.should.push(funcQueryByDistance);
    }else if(filter && filter.trim()=="byProfit"){//根据佣金排序
        //complexQuery.query.bool.should.push(funcQueryByProfit);
        complexQuery.sort.push(sortByProfit);
    }else if(filter && filter.trim()=="byRank"){//根据评价排序
        //complexQuery.query.bool.should.push(funcQueryByRank);
        complexQuery.sort.push(sortByRank);
    }else{
        //do nothing
        console.log("Unsupport filter type.[filter]",filter);
    }

    //默认根据得分及时间排序
    complexQuery.sort.push(sortByScore);
    complexQuery.sort.push(sortByTimestamp);

    //TODO 添加vals
    //TODO 添加cost
    //TODO 添加satisify

    //返回query
    return complexQuery;
}

//搜索得到单品内容列表
function loadItems(){//获取内容列表
    //构建esQuery
    esQuery = buildEsQuery();//完成query构建。其中默认设置了每页条数
    //处理翻页
    esQuery.from = (page.current+1) * page.size;
    console.log("\ntry search by query.[esQuery]",esQuery,"\n");
    $.ajax({
        url:"https://data.pcitech.cn/article/_search",
        type:"post",
        data:JSON.stringify(esQuery),//注意：nginx启用CORS配置后不能直接通过JSON对象传值
        headers:{
            "Content-Type":"application/json",
            "Authorization":"Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
        },
        crossDomain: true,
        timeout:3000,//设置超时
        success:function(data){
            console.log("got result",data);
            if(data.hits.total == 0 || data.hits.hits.length == 0){//如果没有内容，则显示提示文字
                console.log("no more results. show no more button.");
                shownomore(true);
                showloading(false);
            }else{
                //更新总页数
                var total = data.hits.total;
                page.total = (total + page.size - 1) / page.size;
                //更新当前翻页
                page.current = page.current + 1;
                //装载具体条目
                data.hits.hits.forEach(function(entry){
                    if(itemKeys.indexOf(entry._source.itemkey)<0){
                        itemKeys.push(entry._source.itemkey);
                        items.push(entry._source);
                    }
                });;

                insertItem();
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

    })
}

//将item显示到页面
//显示布局为左右两列，左侧为图片Logo，右侧为内容详情。内容详情包括：来源+标题；价格及佣金；标签列表
function insertItem(){
    console.log("try to insert items.");
    // 加载内容
    var item = items[num-1];
    if(!item){
        shownomore(true);
        return;
    }

    console.log("try to insert item.",item);
    //文章若无logo，随机指定一个
    logo = "https://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg";
    if(item.logo){
        logo = item.logo;
    }

    //价格标签
    var highlights = "<div class='itemTags'>";
    highlights += "<a class='itemTagPrice' href='#'>"+(item.price.currency?item.price.currency:"¥")+(item.type=="item"?item.price.sale:(item.price.sale+"-"+item.price.bid))+"</a>";//board的价格显示范围
    highlights += "<a class='distributor' href='#' style='font-size:12px;font-weight:bold;padding:2px;color:darkgreen;line-height:18px;vertical-align:middle;'>"+item.distributor.name+"</a>";
    highlights += "</div>";

    //佣金标签
    var profitTags = "<div style='margin-top:-18px;'>";
    if(item.price&&item.price.profit&&item.type=='item'){//单品佣金显示
      profitTags += "<span class='profitTipOrder'>单返</span><span class='itemTagProfitOrder' href='#'>¥"+(parseFloat((Math.floor(item.price.profit*100)/100).toFixed(2)))+"</span>";
      if(item.price&&item.price.profit2&&item.price.profit2>0.01)profitTags += "<span class='profitTipTeam'>团返</span><span class='itemTagProfitTeam' href='#'>¥"+(parseFloat((Math.floor(item.price.profit2*100)/100).toFixed(2)))+"</span>";
    }else if(item.price&&item.type=='board'){//集合佣金显示
        //店返：范围
      profitTags += "<span class='profitTipOrder'>单返</span><span class='itemTagProfitOrder' href='#'>¥"+(parseFloat((Math.floor(item.price.profit*100)/100).toFixed(2)))
      if(item.price&&item.price.profit2&&item.price.profit2>0.01&&item.price.profit2>item.price.profit)profitTags += "-"+(parseFloat((Math.floor(item.price.profit2*100)/100).toFixed(2)));
      profitTags += "</span>";
        //团返：注意是前端手动计算的，按照店返的20%计算
      profitTags += "<span class='profitTipTeam'>团返</span><span class='itemTagProfitTeam' href='#'>¥"+(parseFloat((Math.floor(item.price.profit*2)/10).toFixed(2)))
      if(item.price&&item.price.profit2&&item.price.profit2>0.01&&item.price.profit2>item.price.profit)profitTags += "-" + (parseFloat((Math.floor(item.price.profit2*20)/100).toFixed(2)));   
      +"</span>";  
    } 
    profitTags += '</div>';

    var tags = "";
    
    var title = "<div class='title' style='font-size:13px;line-height:16px;'>"+item.title+"</div>";
    var image = "<img src='"+logo+"' style='width:60px;object-fit:cover;'/>";
    var description = "<div class='description'>"+item.updateDate+"</div>";//更新时间

    //操作按钮：默认认为是单品
    var btns = "<div style='margin-top:-10px;'><span id='view"+item.itemkey+"' style='color:#006cfd;font-size:12px;' data-url='"+item.url+"'>查看内容</span>"+
               "<span id='item"+item.itemkey+"' style='margin-left:10px;color:#006cfd;font-size:12px;'>查看商品</span>"+ 
               "<span id='copy"+item.itemkey+"' style='margin-left:10px;color:#006cfd;font-size:12px;'>复制专属链接</span></div>"; 
    if(item.type=='board'){
        btns = "<div style='margin-top:-10px;'><span id='view"+item.itemkey+"' style='color:#006cfd;font-size:12px;' data-url='"+item.url+"'>查看内容</span>"+
               "<span id='board"+item.itemkey+"' style='margin-left:10px;color:#006cfd;font-size:12px;'>查看商品</span>"+ 
               "<span id='copy"+item.itemkey+"' style='margin-left:10px;color:#006cfd;font-size:12px;'>复制专属链接</span></div>";         
    }

    $("#waterfall").append("<li><div class='task' data='"+item.itemkey+"' data-title='"+item.title+"' data-url='"+item.url+"'><div class='task-logo'>" + image +"</div><div class='task-tags'>" +title +highlights+profitTags+btns+"</div></li>");
    num++;

    //注册事件：点击查看图文内容
    //跳转到物料页面。需要带上当前达人信息
    $("#view"+item.itemkey).click(function(){
        var targetUrl = $(this).attr("data-url")+"?fromBroker="+broker.id+"&fromUser"+app.globalData.userInfo._key+"&fromUsername="+app.globalData.userInfo.nickname;    
        console.log("Publisher::material now jump to article.",targetUrl);
        //window.location.href = "../index.html";   
        window.location.href = targetUrl;
    });
    //复制链接
    var targetUrl = item.url+"?fromBroker="+broker.id+"&fromUser"+app.globalData.userInfo._key+"&fromUsername="+app.globalData.userInfo.nickname;    
    $('#copy'+item.itemkey).attr("data-clipboard-text",targetUrl);
    var clipboard = new ClipboardJS('#copy'+item.itemkey);
    clipboard.on('success', function(e) {
        console.info('broker url is copied:', e.text);
        siiimpleToast.message('专属链接已复制，请用浏览器打开~~',{
              position: 'bottom|center'
            });  
        //e.clearSelection();            
    });     
    //跳转到单品或列表：
    if(item.type=='board'){
        $("#board"+item.itemkey).click(function(){
            var targetUrl = "../board2-waterfall.html?id="+item.itemkey; 
            console.log("Publisher::material now jump to board.",targetUrl);
            //window.location.href = "../index.html";   
            window.location.href = targetUrl;
        });        
    }else{
        $("#item"+item.itemkey).click(function(){
            var targetUrl = "../info2.html?id="+item.itemkey; 
            console.log("Publisher::material now jump to item.",targetUrl);
            //window.location.href = "../index.html";   
            window.location.href = targetUrl;
        });       
    }


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
            console.log("try to display user info.",res.data);
            insertBroker(res.data);//显示达人信息
            registerTimer(res.data.id);//加载该达人的board列表
            //开始获取数据
            startQueryDataLoop();
        }
    });
}

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

function loadCategories(currentCategory){
    $.ajax({
        url:app.config.sx_api+"/mod/channel/rest/channels/active",
        type:"get",
        success:function(msg){
            var navObj = $(".navUl");
            for(var i = 0 ; i < msg.length ; i++){
                navObj.append("<li data='"+msg[i].id+"' data-tagging='"+(msg[i].tagging?msg[i].tagging:"")+"'>"+msg[i].name+"</li>");
                if(currentCategory == msg[i].id){//高亮显示当前选中的category
                    $(navObj.find("li")[i]).addClass("showNav");
                    tagging = msg[i].tagging;
                    helper.traceChannel(currentCategory,'click',currentPersonJson);//记录频道点击事件：对于通过详情页、board页进入的同时记录
                }
            }
            //注册点击事件
            navObj.find("li").click(function(){
                var key = $(this).attr("data");
                var tagging = $(this).attr("data-tagging");                
                if(key == category){//如果是当前选中的再次点击则取消高亮，选择“全部”
                    key = "all";
                    tagging = "";
                    changeCategory(key,tagging);//更换后更新内容
                    $(navObj.find("li")).removeClass("showNav");
                    $(".navUl>li:contains('全部')").addClass("showNav");
                }else{
                    changeCategory(key,tagging);//更换后更新内容
                    helper.traceChannel(key,'click',currentPersonJson);//记录频道点击事件
                    $(navObj.find("li")).removeClass("showNav");
                    $(this).addClass("showNav");//不好，这个是直接通过“全部”来完成的                    
                }
            })
        }
    })    
}

/**************加载关心的人及客群列表********************/
var persons = [];
var currentPerson = app.globalData.userInfo?app.globalData.userInfo._key:'0';
var currentPersonTagging = "";//记录当前用户的标签清单，用于根据标签显示内容
var personKeys = [];//标记已经加载的用户key，用于排重
var inputPerson = null;//接收指定的personId或personaId
//load predefined personas
function loadPersonas() {
    util.AJAX(app.config.data_api+"/persona/personas/broker/"+app.globalData.userInfo._key, function (res) {
      var arr = res;
      //将persona作为特殊的person显示到顶部
      for (var i = 0; i < arr.length; i++) {
        var u = arr[i];
        if(personKeys.indexOf(u._key) < 0){
          u.nickName = u.name;//将persona转换为person
          u.avatarUrl = u.image;//将persona转换为person
          u.personOrPersona = "persona";//设置标记，用于区分persona及person
          u.relationship = "客群";
          persons.push(u);
          personKeys.push(u._key);
        }
      }

      //新增客群按钮
      var addPersonaKey = "btn-add-persona";
      personKeys.push(addPersonaKey);
      persons.push({
        nickName:"添加客群",
        avatarUrl:"images/add-persona.png",
        relationship:"壮大团队赚钱",
        _key:addPersonaKey
      });       

      //显示滑动条
      //showSwiper(); 
    });
}

//load related persons
function loadPersons() {
    util.AJAX(app.config.data_api+"/user/users/connections/"+app.globalData.userInfo._key, function (res) {
      var arr = res;
      //从列表内过滤掉当前用户：当前用户永远排在第一个
      if (app.globalData.userInfo != null && personKeys.indexOf(app.globalData.userInfo._key) < 0){
          //添加当前用户自己   
          var myself = app.globalData.userInfo;
          myself.relationship = "自己";
          persons.push(myself);
          personKeys.push(myself._key);        
          //加载broker信息，如果是机构达人，则将机构作为第一个关心的人。直接在当前用户上更改其关系、tag
          var sxBrokerInfo = $.cookie('sxBrokerInfo');
          console.log("load broker info from cookie.",sxBrokerInfo);
          if(sxBrokerInfo && sxBrokerInfo.trim().length>0){
            var orgnization = {
                nickName:app.globalData.userInfo.nickName,
                avatarUrl:app.globalData.userInfo.avatarUrl,
                relationship:"机构用户",
                _key:"orgnization"              
            };
            console.log("get sxBrokerInfo info from cookie.",sxBrokerInfo);
            var sxBroker = JSON.parse(sxBrokerInfo);
            if(sxBroker.orgnization && sxBroker.orgnization.name && sxBroker.orgnization.name.trim().length>0)
              orgnization.relationship = sxBroker.orgnization.name;
            if(sxBroker.orgnization && sxBroker.orgnization.id && sxBroker.orgnization.id.trim().length>0){
              orgnization.tags = [];
              orgnization.tags.push(sxBroker.orgnization.id);
              console.log("orgnization info.",orgnization);
              persons.push(orgnization);
              personKeys.push(orgnization._key);               
            }           
          }
          //end of orgnization      
      }
      for (var i = 0; i < arr.length; i++) {
        var u = arr[i];
        if(personKeys.indexOf(u._key) < 0/* && u.openId*/){//对于未注册用户不显示
          persons.push(u);
          personKeys.push(u._key);
        }
      } 

      //新增关心的人按钮
      var addPersonKey = "btn-add-related-person";
      personKeys.push(addPersonKey);
      persons.push({
        nickName:"添加关心的人",
        avatarUrl:"images/add-person.png",
        relationship:"分享赚钱",
        _key:addPersonKey
      });      

      //显示顶部滑动条
      /**
      if(util.hasBrokerInfo()){//如果是达人，则继续装载画像
          loadPersonas();
      }else{//否则直接显示顶部滑动条
          showSwiper();
      } 
      //**/
    });
}

function showSwiper(){
    //将用户装载到页面
    for (var i = 0; i < persons.length; i++) {
      insertPerson(persons[i]);
    }    
    //显示滑动条
    var mySwiper = new Swiper ('.swiper-container', {
        //slidesPerView: 4,
        slidesPerView: from=="web"?parseInt(document.getElementsByTagName('html')[0].clientWidth/100):4,
    });  
    //调整swiper 风格，使之悬浮显示
    $(".swiper-container").css("position","relative");
    $(".swiper-container").css("left","0");
    $(".swiper-container").css("top","40");
    $(".swiper-container").css("z-index","999");
    $(".swiper-container").css("background-color","red");
    //$(".swiper-container").css("margin-bottom","3px");
  
    //将当前用户设为高亮  
    if(inputPerson){
      if(personKeys.indexOf(inputPerson)>-1 && persons[personKeys.indexOf(inputPerson)]){//有输入用户信息则优先使用
        currentPerson = inputPerson;
        currentPersonTagging = persons[personKeys.indexOf(inputPerson)].tags?persons[personKeys.indexOf(inputPerson)].tags.join(" "):"";
      }else{//指定了输入用户，但用户不存在，则不使用任何用户过滤
        currentPerson = "0";
        currentPersonTagging = "";
      }
    }else{//根据当前用户加载数据：默认使用第一个
      currentPerson = persons[0]._key;
      currentPersonTagging = persons[0].tags?persons[0].tags.join(" "):"";   
    }   
    //当前不需要切换，默认显示全部
    //changePerson(currentPerson,currentPersonTagging);   
    highlightPerson(currentPerson,currentPersonTagging);      
}
/**
function insertPerson(person){
    // 显示HTML
    var html = '';
    html += '<div class="swiper-slide">';
    html += '<div class="person" id="'+person._key+'" data-type="'+(person.personOrPersona&&person.personOrPersona.trim().length>0?person.personOrPersona:"person")+'" data-tagging="'+(person.tags?person.tags.join(" "):"")+'">';
    var style= person._key==currentPerson?'-selected':'';
    html += '<div class="person-img-wrapper"><img class="person-img'+style+'" src="'+person.avatarUrl+'"/></div>';
    html += '<div class="person-info">';
    html += '<span class="person-name">'+(person.openId?"":"☆")+person.nickName+'</span>';
    html += '<span class="person-relation">'+(person.relationship?person.relationship:"我关心的TA")+'</span>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    $("#persons").append(html);

    //注册事件:点击后切换用户
    //通过jquery事件注入
    if(person._key=="btn-add-related-person"){//新增关心的人，直接跳转
      $("#"+person._key).click(function(e){
          window.location.href="user-choosepersona.html?from=feeds";
      });
    }else if(person._key=="btn-add-persona"){//新增客群，直接跳转
      $("#"+person._key).click(function(e){
          window.location.href="broker/my-addpersona.html?from=feeds";
      });
    }else{//切换数据列表
      $("#"+person._key).click(function(e){
          console.log("try to change person by jQuery click event.",person._key,e.currentTarget.id,e);
          if(e.currentTarget.id == currentPerson){//如果再次点击当前选中用户，则取消选中
            changePerson("0","");
          }else{//否则，高亮显示选中的用户
            changePerson(e.currentTarget.id,e.currentTarget.dataset.tagging);
          }
          
      });
    }
}
//**/
function changePerson (personId,personTagging) {
    var ids = personId;
    if (app.globalData.isDebug) console.log("Feed::ChangePerson change person.",currentPerson,personId);
    $("#"+currentPerson).removeClass("person-selected");
    $("#"+currentPerson).addClass("person");
    $("#"+ids).removeClass("person");
    $("#"+ids).addClass("person-selected");   

    $("#"+currentPerson+" img").removeClass("person-img-selected");
    $("#"+currentPerson+" img").addClass("person-img");
    $("#"+ids+" img").removeClass("person-img");
    $("#"+ids+" img").addClass("person-img-selected");

    $("#"+currentPerson+" span").removeClass("person-name-selected");
    $("#"+currentPerson+" span").addClass("person-name");
    $("#"+ids+" span").removeClass("person-name");
    $("#"+ids+" span").addClass("person-name-selected");

    $("#waterfall").empty();//清空原有列表
    $("#waterfall").css("height","20px");//调整瀑布流高度
    //showloading(true);//显示加载状态

    //重新加载用户明细及模型
    loadPersonById(personId);//注意是同步调用

    page.current = -1;//从第一页开始查看
    currentPerson = ids;//修改当前用户
    currentPersonTagging = personTagging;//修改当前用户推荐Tagging
    items = [];//清空列表
    num = 1;//从第一条开始加载
    loadData();//重新加载数据
  } 

  function changeCategory(key,q){
    category = key;//更改当前category
    categoryTagging = q;//使用当前category对应的查询更新查询字符串
    loadData();
}

  function loadData(){
    items = [];//清空列表
    itemKeys = [];//同步清空itemKey列表
    $("#waterfall").empty();//清除页面元素
    num=1;//设置加载内容从第一条开始
    page.current = -1;//设置浏览页面为未开始
    console.log("query by tagging.[categoryTagging]"+categoryTagging+"[personTagging]"+currentPersonTagging+"[tagging]"+tagging+"[filter]"+filter);
    loadItems();//重新加载数据
}

//分享到微信群：直接构建互阅班车，便于统计结果
function registerShareHandler(){
    //准备分享url
    var startTime = new  Date().getTime();
    var shareUrl = window.location.href;//.replace(/articles/g,"articles-grouping");//目标页面将检查是否关注与注册

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
                    title:"内容带货，让所读即所得", // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:"https://www.biglistoflittlethings.com/static/logo/distributor/ilife.png", // 分享图标
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
                    title:"内容带货，让所读即所得", // 分享标题
                    desc:"精准选品，在文章中嵌入符合读者需求的商品", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: "https://www.biglistoflittlethings.com/static/logo/distributor/ilife.png", // 分享图标
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
