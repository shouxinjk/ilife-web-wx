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
    var args = getQuery();//获取参数
    from = args["from"]?args["from"]:"mp";//来源于选品工具，包括公众号流量主、知乎、头条、简书等
    fromUser = args["fromUser"]?args["fromUser"]:"";//从连接中获取分享用户ID

    if(_sxdebug)console.log("got params from & fromUser from query.",from,fromUser);

    $('#waterfall').NewWaterfall({
        width: columnWidth,
        delay: 100,
    });  

    //监听父窗口postmessage
    listenPostMessage();

    //检查toolbar状态
    checkToolbarStatus();

    //加载用户信息，同时会加载达人信息
    loadUserInfoByOpenid(fromUser);  

    //加载支持的数据源列表
    loadPlatformSources();

    //在页面初次加载时，直接检查本地pendingItem，有则直接显示
    /**
    if($.cookie("sxPendingItem") && $.cookie("sxPendingItem").trim().length > 0 ){
        isCollected = true;//认为是已经采集完成
        currentItem = JSON.parse( $.cookie("sxPendingItem") );
        showContent(currentItem);
    }
    //**/
    //注册操作事件：显示标注面板
    $("#sxItemFormBtn").click(function(){
        showLabelingFormDiv();
    });     

    //注册操作事件：显示数据源面板
    $("#sxItemSourceListBtn").click(function(){
        showPlatformSourceDiv();
    }); 

    //注册提交标注数据事件
    $("#submitFormBtn").click(function(){
        submitItemForm();
    });     
 
});

//调试标志
var _sxdebug = false;

//记录分享用户、分享达人
var from = "orgnization";//数据来源，默认为机构达人
var fromUser = "";

//使用代理避免跨域问题。后端将代理到指定的URL地址。使用https
var imgPrefix = "https://www.biglistoflittlethings.com/3rdparty?url=";

util.getUserInfo();//从本地加载cookie

var broker = {
  id:"77276df7ae5c4058b3dfee29f43a3d3b"
};

//加载board信息
var boardId = null;

var columnWidth = 450;//默认宽度300px
var columnMargin = 5;//默认留白5px

var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var items = [];//所有内容列表，用于显示历史列表

//正在标注的条目
var currentItem = {};//当前标注条目
var isCollected = false;//记录是否采集到数据

//支持的类目
var categories = [];
var cascader = null;//级联选择器实例

//直接读取用户信息
function loadUserInfoByOpenid(openid){
  util.checkPerson({openId:openid},function(res){
    app.globalData.userInfo = res;//直接从请求获取信息
    loadBrokerInfoByOpenid(openid);//用户加载后再加载达人信息
    //loadPersons();//用户加载后加载关联用户及客群
    //更新broker头像及名称
    //注意有同源问题，通过postMessage完成
    var brokerMessage = {
      sxBrokerLogo:app.globalData.userInfo.avatarUrl,
      sxBrokerName:app.globalData.userInfo.nickName
    };
    window.parent.postMessage(brokerMessage, "*");//不设定origin，直接通过属性区分
    if(_sxdebug)console.log("post broker message.",brokerMessage);
  });
}

//直接读取达人信息
function loadBrokerInfoByOpenid(openid){
  util.checkBroker(openid,function(res){
    //broker = util.getBrokerInfo();
    broker = res.data;//直接从请求获取信息

    //直接写入cookie，避免同源问题
    document.cookie = "sxBrokerInfo="+JSON.stringify(res.data)+"; SameSite=None; Secure";
    document.cookie = "hasBrokerInfo="+res.status+"; SameSite=None; Secure";

    //TODO：在加载达人后再加载数据，避免brokerInfo缺失
    //startQueryDataLoop();

    //更新broker头像及名称
    //注意有同源问题，通过postMessage完成
    var brokerMessage = {
      sxBrokerLogo:app.globalData.userInfo.avatarUrl,
      sxBrokerName:app.globalData.userInfo.nickName,     
      sxBrokerOrgnization:broker.orgnization.name,   
      sxBrokerRealName:broker.name
    };
    window.parent.postMessage(brokerMessage, "*");//不设定origin，直接通过属性区分
    if(_sxdebug)console.log("post broker message.",brokerMessage);
  });
}

//加载类目数据，加载完成后显示级联选择器
function loadCategories(){
    $.ajax({
        url:"https://data.shouxinjk.net/ilife/a/mod/itemCategory/all-categories?parentId=1",
        type:"get",
        success:function(res){
            //装载categories
            if(_sxdebug)console.log("got all categories",res);
            categories = res;  
            //显示级联选择
            showCascader(currentItem.meta?currentItem.meta.category:null);
        }
    })    
}

//显示级联选择器
function showCascader(categoryId){
    cascader = new eo_cascader(categories, {
        elementID: 'category-wrap',
        multiple: false, // 是否多选
        // 非编辑页，checkedValue 传入 null
        // 编辑时 checkedValue 传入最后一级的 ID 即可
        checkedValue: categoryId?[categoryId] : null,
        separator: '/', // 分割符 山西-太原-小店区 || 山西/太原/小店区
        clearable: false, // 是否可一键删除已选
        onSelect:function(selectedCategory){//回调函数，参数带有选中标签的ID和label。回传为：{id:[],label:[]}//其中id为最末级选中节点，label为所有层级标签
            if(_sxdebug)console.log("crawler::category item selected.",selectedCategory);
            //更新当前item的category。注意更新到meta.category下
            currentItem.meta = {category:selectedCategory.id[0],categoryName:selectedCategory.label[selectedCategory.label.length-1]};//仅保存叶子节点
            currentItem.status.classify = "ready";
            currentItem.timestamp.classify = new Date();
            //加载属性值列表
            loadProps(selectedCategory.id[0]);
            //更新类目映射：修改后直接提交修改
            changeCategoryMapping();            
            //显示批量更新stuff类目按钮：注意：由于是更改所有stuff，效率很低
            $("#btnBatchUpdateStuff").css("display","block");
        }
    });
    //对于已经设置的类目则直接显示属性列表
    if(currentItem.meta && currentItem.meta.category)
        loadProps(currentItem.meta.category);
}


//批量修改my_stuff
//将my_stuff中classify=pending,且source、category与当前stuff相同的同时修改
//TODO : 太耗时。需要调整为异步处理
function batchUpdateStuffCategory(item){
    var data = {
        source:item.source,
        category:item.category,
        mappingId:item.meta.category
    };
    if(_sxdebug)console.log("try to mapping stuff category.",data);
    $.ajax({
        url:"https://data.shouxinjk.net/_db/sea/my/stuff/mapping/category",
        type:"patch",
        data:JSON.stringify(data),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept":"application/json"
        },
        success:function(result){
            console.log("已更新所有同类目Stuff",result);
            $.toast({
                heading: 'Success',
                text: '已更新所有同类目Stuff',
                showHideTransition: 'fade',
                icon: 'success'
            });
        }
    });
}

//批量修改my_stuff及platform_categories
//更新platform_categories中的设置条目：注意：由于my_stuff内无cid，不能采用insert方式，只用更新方式。另外，如果已经设置，则以此处更新优先
//TODO：需要修改为更新stuff，当前是更新category mapping
function batchUpdatePlatformCategories(item){
    var name = "";
    var names = [];
    if(Array.isArray(item.category)){
        name = item.category[item.category.length-1];
        names = item.category;
    }else if(item.category){
        var array = item.category.split(" ");
        name = array[array.length-1];
        names = array;
    }
    var platform_category = {
        platform:item.source,
        name:name,
        categoryId:item.meta.category
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
            $.toast({
                heading: 'Success',
                text: '已更新所有标准类目相同的Stuff',
                showHideTransition: 'fade',
                icon: 'success'
            });
        },
        error:function(){
            console.log("upsert failed.",platform_category);
        }
    }); 
}

//修改目录映射
function changeCategoryMapping(){
    var name = "";
    if(Array.isArray(currentItem.category)){
        name = currentItem.category[currentItem.category.length-1];
    }else if(currentItem.category){
        var array = currentItem.category.split(" ");
        name = array[array.length-1];
    }
    var platform_category = {
        platform:currentItem.source,
        name:name,
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


function loadItems(){//获取内容列表
    if(_sxdebug)console.log("start load items from cookie.");
    var sxPendingItemInfo = $.cookie('sxPendingItem');//存储的就是列表，[{},{},{}]
    if(sxPendingItemInfo && sxPendingItemInfo.trim().length>0){
      items = JSON.parse(sxPendingItemInfo);
      insertItem();
    }else{
      shownomore(true);
    }
}

//将item显示到页面
function insertItem(item){
    /**
    // 加载内容
    var item = items[num-1];
    //检查是否还有，如果没有则显示已完成
    if(!item){
      shownomore(true);
      return;
    }

    //**/

    //隐藏no-more-tips
    $("#no-results-tip").toggleClass("no-result-tip-hide",true);
    $("#no-results-tip").toggleClass("no-result-tip-show",false);    

    var imgWidth = 80; //指定为固定宽度 //columnWidth-2*columnMargin;//注意：改尺寸需要根据宽度及留白计算，例如宽度为360，左右留白5，故宽度为350
    var imgHeight = random(50, 300);//随机指定初始值
    //计算图片高度
    var img = new Image();
    img.src = item.images?item.images[0]:"https://www.biglistoflittlethings.com/list/images/logo00.jpeg";
    var orgWidth = img.width;
    var orgHeight = img.height;
    imgHeight = orgHeight/orgWidth*imgWidth;
    //计算文字高度：按照1倍行距计算
    //if(_sxdebug)console.log("orgwidth:"+orgWidth+"orgHeight:"+orgHeight+"width:"+imgWidth+"height:"+imgHeight);
    var image = "<img src='"+imgPrefix+item.images[0]+"' width='"+imgWidth+"' height='"+imgHeight+"' style='margin:0 auto'/>"
    //var tagTmpl = "<strong style='white-space:nowrap;display:inline-block;border:1px solid #8BC34A;background-color: #8BC34A;color:white;font-weight: bold;font-size: 10px;text-align: center;border-radius: 5px;margin-left:2px;margin-right:1px;margin-top:-2px;padding:2px;vertical-align:middle;'>__TAG</strong>";
    var highlights = "<div class='itemTags' style='line-height: 18px;'>";
    var prices = "";
    prices += "<strong style='font-size:14px;font-weight: bold;background-color: white;color:darkred;padding:2px;'>"+(item.price.currency?item.price.currency:"¥")+item.price.sale+"</strong>";
    if(item.price.coupon>0&&item.price.coupon<item.price.sale){//有些券金额比售价还高，不显示
        prices += "<strong style='font-size:14px;font-weight: bold;color:#fe4800;margin-left:2px;'>券</strong><strong href='#' style='font-size:14px;font-weight: bold;color:#fe4800;'>"+item.price.coupon+"</strong>";
    }    
    //购买按钮
    var buyButton = "<strong style='float:right;margin-right:10px;background-color:darkred;color:white;text-align:right;padding-left:5px;padding-right:5px;font-size:14px;border-radius:3px;' id='view-"+item._key+"' data-item='"+item._key+"'>去看看</strong>";
    highlights += "</div>";

    //distributor
    var distributor = "<div><strong class='itemTag' href='#' style='font-size:13px;font-weight: bold;background-color: white;color:darkgreen;padding:2px;line-height: 18px;vertical-align:middle;border:0'>"+item.distributor.name+"</strong></div>";

    var profitTags = "";
    if(util.hasBrokerInfo()){//如果是推广达人则显示佣金
        showHighProfitLink();//显示高佣链接入口
        if(item.profit&&item.profit.type=="3-party"){//如果已经存在则直接加载
          if(item.profit&&item.profit.order){
              profitTags += "<div class='itemTags profit-show' style='margin:0;' id='profit-tip-"+item._key+"'><span class='profitTipOrder'>店返</span><span class='itemTagProfitOrder' href='#'>¥"+(parseFloat((Math.floor(item.profit.order*10)/10).toFixed(1)))+"</span></div>";
              if(item.profit&&item.profit.team&&item.profit.team>0.1)profitTags += "<div class='itemTags profit-show' style='margin:0;'><span class='profitTipTeam'>团返</span><span class='itemTagProfitTeam' href='#'>¥"+(parseFloat((Math.floor(item.profit.team*10)/10).toFixed(1)))+"</span></div>";
          }else if(item.profit&&item.profit.credit&&item.profit.credit>0){
              profitTags += "<div class='itemTags profit-show' style='margin:0;'><span class='profitTipCredit'>积分</span><span class='itemTagProfitCredit' href='#'>"+(parseFloat((Math.floor(item.profit.credit*10)/10).toFixed(0)))+"</span></div>";
          }
        }else if(item.profit && item.profit.type=="2-party"){//如果是2方分润则请求计算
            //profitTags = "<div id='profit"+item._key+"' class='itemTags profit-hide' style='margin-bottom:0;'></div>";
            //采集时不立即对佣金进行计算，统一由后端任务自动完成
            //getItemProfit2Party(item);
        }else{//表示尚未计算。需要请求计算得到该item的profit信息
            //profitTags = "<div id='profit"+item._key+"' class='itemTags profit-hide' style='margin-bottom:0;'></div>";
            //采集时不立即对佣金进行计算，统一由后端任务自动完成
            //getItemProfit(item);
        }
    }

    var tags = "<div class='itemTags' style='line-height: 12px;vertical-align: middle;margin-bottom:2px;'>";
    var taggingList = [];
    if(item.tagging&&item.tagging.length>0){
        item.tagging.split(" ");
    }
    for(var t in taggingList){
        var txt = taggingList[t];
        if(txt.trim().length>1 && txt.trim().length<6){
            tags += tagTmpl.replace("__TAGGING",txt).replace("__TAG",txt);
        }
    }
    if(item.categoryId && item.categoryId.trim().length>1){
        tags += tagTmpl.replace("__TAGGING",item.category).replace("__TAG",item.category);
    }
    tags += "</div>";
    //var tags = "<span class='title'><a href='info.html?category="+category+"&id="+item._key+"'>"+item.title+"</a></span>"
    var title = "<div class='title' style='font-weight:bold;font-size:11px;line-height: 16px;'>"+item.title+"</div>"

    var cardHtml = "";
    cardHtml += "<div class='cardWrapper' style='width:100%;margin:auto;display:flex;flex-direction: column;align-items: center;'>";
      //卡片内容
      cardHtml += "<div style='border:2px dashed silver;width:95%;margin-top:5px;'>";//卡片边框
        ////////图文卡片样式////////////
          //*
          cardHtml += "<div id='imageText"+item._key+"' style='width:90%;margin:auto;display:flex;flex-direction: row;align-items: center;border-radius:5px;'>";
            //图片
            cardHtml += "<div style='width:30%;margin:auto;align-items: center;padding-right:5px;'>";
              cardHtml += image;
            cardHtml += "</div>";   
            //标题、价格、标签
            cardHtml += "<div style='width:70%;display:flex;flex-direction: column;align-items: left;'>";  
              cardHtml += distributor;            
              cardHtml += title;
              cardHtml += tags;
              cardHtml += prices; 
            cardHtml += "</div>"; 
          cardHtml += "</div>";
          //**/
        ////////结束：图文卡片样式////////////

      cardHtml += "</div>";
      //操作按钮
      cardHtml += "<div id='cardWrapper"+item._key+"' style='width:98%;padding-left:10px;display:flex;flex-direction: row;align-items: left;'>";
        //if(!$("#profit-tip-"+item._key))//部分情况下可能由于出现重复条目，导致佣金提示显示两次，此处强行保护
        cardHtml += profitTags;
        //cardHtml += copyBtns;
      cardHtml += "</div>";  
      //间隔空白 
      cardHtml += "<div style='line-height:15px;'>&nbsp</div>";  
    cardHtml += "</div>";
    $("#waterfall").append("<li>"+cardHtml+"</li>");
    num++;

    //注册事件：在新tab页内显示商品详情
    $("#view-"+item._key).click(function(){
        //跳转到详情页
        window.open("info2.html?category="+category+"&id="+item._key);
    });  

    // 表示加载结束
    loading = false;
}


//检查更新达人CPS链接。如果已有链接则直接使用，否则需要动态生成
function checkCpsLink(item){//支持点击事件
    var benificiaryBrokerId = "system";//默认为平台直接分享
    if(broker&&broker.id){//如果当前分享用户本身是达人，则直接引用其自身ID
        benificiaryBrokerId=broker.id;
    }/**else if(fromBroker && fromBroker.trim().length>0){
        benificiaryBrokerId=fromBroker;
    }//**/
    //记录发表日志
    logstash(item,from,"publish",fromUser,benificiaryBrokerId,function(){
      //do nothing
    });   
    //处理cps链接
    var target = item.url;
    if(item.link.cps && item.link.cps[benificiaryBrokerId]){//能够直接获得达人链接则直接显示
        pendingItemCpsLink=item.link.cps[benificiaryBrokerId];
        document.execCommand("copy");//触发拷贝事件
    }else{//否则请求其链接并显示
        getBrokerCpsLink(benificiaryBrokerId,item);
    }      
}

//根据Broker查询得到CPS链接
function getBrokerCpsLink(brokerId,item) {
    var data={
        brokerId:brokerId,
        source:item.source,
        category:"",//注意：不按照类别进行区分
        //category:item.categoryId?item.categoryId:"",
        url:item.link.wap
    };
    if(_sxdebug)console.log("try to generate broker specified url",data);
    util.AJAX(app.config.sx_api+"/mod/cpsLinkScheme/rest/cpslink", function (res) {
        if(_sxdebug)console.log("======\nload cps link info.",data,res);
        if (res.status) {//用返回的cps链接
            pendingItemCpsLink=res.link;
            //更新到item，更新完成后跳转到cps链接地址
            updateBrokerCpsLink(item,brokerId,res.link);
        }else{//如果不能生成链接则直接使用已有链接
            if(item.link.wap2){
                pendingItemCpsLink=item.link.wap2;
            }else if(item.link.wap){
                pendingItemCpsLink=item.link.wap;
            }else{//理论上不会到这里
                pendingItemCpsLink=item.url;
            }
        }
        document.execCommand("copy");//触发拷贝事件
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
    if (app.globalData.isDebug) if(_sxdebug)console.log("Info2::updateItem update item with broker cps link.[itemKey]"+item._key,data);
    $.ajax({
        url:url,
        type:"PATCH",
        data:JSON.stringify(data),//注意：nginx启用CORS配置后不能直接通过JSON对象传值
        headers:header,
        timeout:2000,//设置超时
        success:function(res){//正确返回则跳转到返回地址
          if (app.globalData.isDebug) if(_sxdebug)console.log("Info2::updateItem update item finished.", res);
          //跳转到cps地址
          //window.location.href = cpsLink;
        },
        complete: function (XMLHttpRequest, textStatus) {//调用执行后调用的函数
            if(textStatus == 'timeout'){//如果是超时，则直接跳转到cps地址，忽略更新stuff失败
              if(_sxdebug)console.log("ajax timeout. jump to cps link directly.",textStatus);
              //window.location.href = cpsLink;
            }
        },
        error: function () {//调用出错执行的函数
            if(_sxdebug)console.log("error occured while update cps link to stuff. jump to cps link directly.");
            //window.location.href = cpsLink;
          }

    });
}

//添加item到board
function addItemToBoard(item){
    if(_sxdebug)console.log("Index::addItemToBoard try to add item to board.", item)
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };     
    var data = {
        item:item._key,
        title:item.title,
        description:item.tags?item.tags.join(" "):"",
        board:{
            id:boardId
        }
    };
    util.AJAX(app.config.sx_api+"/mod/boardItem/rest/board-item/", function (res) {
        if(_sxdebug)console.log("Index::addItemToBoard item added successfully.", res)
        if(res.status){
            if(_sxdebug)console.log("Index::addItemToBoard item added successfully", res)
            $.toast({//浮框提示已添加成功
                heading: '已添加到清单',
                text: '可以继续添加商品或编辑清单',
                showHideTransition: 'fade',
                icon: 'success'
            });            
        }
    }, "POST",data,header);
}

//查询佣金。2方分润。返回order/team/credit三个值
function getItemProfit2Party(item) {
    var data={
        source:item.source,
        price:item.price.sale,
        amount:item.profit.amount?item.profit.amount:0,
        category:item.categoryId?item.categoryId:""
    };
    util.AJAX(app.config.sx_api+"/mod/commissionScheme/rest/profit-2-party", function (res) {
        if(_sxdebug)console.log("\ngot profit info.",data,res);
        var showProfit = false;
        var html = "";
        if (res.order) {//店返
            html += "<div class='itemTags profit-show' style='margin:0;' id='profit-tip-"+item._key+"'><span class='profitTipOrder'>店返</span><span class='itemTagProfitOrder' href='#'>¥"+(parseFloat((Math.floor(res.order*10)/10).toFixed(1)))+"</span></div>";
            if(res.team && res.team>0.1){//过小的团返不显示
                html += "<div class='itemTags profit-show' style='margin:0;'><span class='profitTipTeam'>团返</span><span class='itemTagProfitTeam' href='#'>¥"+(parseFloat((Math.floor(res.team*10)/10).toFixed(1)))+"</span></div>";
            }
        }else if(res.credit&&res.credit>0){//如果没有现金则显示积分
            html += "<div class='itemTags profit-show' style='margin:0;'><span class='profitTipCredit'>积分</span><span class='itemTagProfitCredit' href='#'>"+(parseFloat((Math.floor(res.credit*10)/10).toFixed(0)))+"</span></div>";
        }else{//这里应该是出了问题，既没有现金也没有积分
            if(_sxdebug)console.log("===error===\nnothing to show.",item,res);
        }
        //显示到界面
        if(html.trim().length>0 /* && !$("#profit-tip-"+item._key)*/){//由于数据可能重复，导致提示会出现多次，强制检查是否重复
            $("#cardWrapper"+item._key).prepend(html);
            /**
            $("#profit"+item._key).html(html);
            $("#profit"+item._key).toggleClass("profit-hide",false);
            $("#profit"+item._key).toggleClass("profit-show",true);
            //**/
        }
        //更新到item
        if(item.profit==null){
          item.profit={};
        }        
        item.profit.order = res.order;
        item.profit.team = res.team;
        item.profit.credit = res.credit;
        item.profit.type = "3-party";   
        //updateItem(item);      //注意：需要进入索引，而不是直接修改原始数据
    },"GET",data);
}

//查询特定条目的佣金信息。返回order/team/credit三个值
function getItemProfit(item) {
    var data={
        source:item.source,
        price:item.price.sale,
        category:item.categoryId?item.categoryId:""
    };
    if(_sxdebug)console.log("try to query item profit",data);
    util.AJAX(app.config.sx_api+"/mod/commissionScheme/rest/profit", function (res) {
        if(_sxdebug)console.log("got profit info.",item,res);
        var showProfit = false;
        var html = "";
        if (res.order) {//店返
            html += "<div class='itemTags profit-show' style='margin:0;' id='profit-tip-"+item._key+"'><span class='profitTipOrder'>店返</span><span class='itemTagProfitOrder' href='#'>¥"+(parseFloat((Math.floor(res.order*10)/10).toFixed(1)))+"</span></div>";
            if(res.team && res.team>0.1){//过小的团返不显示
                html += "<div class='itemTags profit-show' style='margin:0;'><span class='profitTipTeam'>团返</span><span class='itemTagProfitTeam' href='#'>¥"+(parseFloat((Math.floor(res.team*10)/10).toFixed(1)))+"</span></div>";
            }
        }else if(res.credit&&res.credit>0){//如果没有现金则显示积分
            html += "<div class='itemTags profit-show' style='margin:0;'><span class='profitTipCredit'>积分</span><span class='itemTagProfitCredit' href='#'>"+(parseFloat((Math.floor(res.credit*10)/10).toFixed(0)))+"</span></div>";
        }else{//这里应该是出了问题，既没有现金也没有积分
            if(_sxdebug)console.log("===error===\nnothing to show.",item,res);
        }
        //显示到界面
        if(html.trim().length>0 /* && !$("#profit-tip-"+item._key)*/){//由于数据可能重复，导致提示会出现多次，强制检查是否重复
            $("#cardWrapper"+item._key).prepend(html);
            /**
            $("#profit"+item._key).html(html);
            $("#profit"+item._key).toggleClass("profit-hide",false);
            $("#profit"+item._key).toggleClass("profit-show",true);
            //**/
        }
        //更新到item
        if(item.profit==null){
          item.profit={};
        }        
        item.profit.order = res.order;
        item.profit.team = res.team;
        item.profit.credit = res.credit;
        item.profit.type = "3-party";   
        //updateItem(item);   //注意：需要进入索引，而不是直接修改原始数据
    },"GET",data);
}

//更新item信息。只用于更新profit
function updateItem(item) {
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };
    var url = app.config.data_api +"/_api/document/my_stuff/"+item._key;
    if (app.globalData.isDebug) if(_sxdebug)console.log("Index::updateItem update item.",item);
    util.AJAX(url, function (res) {
      if (app.globalData.isDebug) if(_sxdebug)console.log("Index::updateItem update item finished.", res);
      //do nothing
    }, "PATCH", item, header);
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
    //注册跳转事件：在某些情况下，搜索不到，直接回到首页，不带参数搜索
    $("#findMoreBtn").click(function(){
      window.location.href = "index.html";
    });    
  }else{
    $("#findMoreBtn").toggleClass("findMoreBtn-hide",true);
    $("#findMoreBtn").toggleClass("findMoreBtn-show",false);
  }
}

//如果是达人则显示高佣入口
function showHighProfitLink(){
    $("#findByProfit").toggleClass("searchBtn-hide",false);
    $("#findByProfit").toggleClass("searchBtn",true);
}

// 自动加载更多：此处用于测试，动态调整图片高度
function random(min, max)
{
    return min + Math.floor(Math.random() * (max - min + 1))
}

function loadData(){
    items = [];//清空列表
    $("#waterfall").empty();//清除页面元素
    num=1;//设置加载内容从第一条开始
    page.current = -1;//设置浏览页面为未开始
    if(_sxdebug)console.log("start load data.");
    loadItems();//重新加载数据
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


//根据ItemCategory类别，获取对应的属性配置，并与数据值融合显示
//0，获取property mapping，采用同步方式。获取后作为属性比对。根据name或者props.name对照
//1，根据key进行合并显示，以itemCategory下的属性为主，能够对应上的key显示绿色，否则显示红色
//2，数据显示，有对应于key的数值则直接显示，否则留空等待填写
function loadProps(categoryId){
    //同步获取propertyMapping：根据source、category（注意是原始类目名称，不是标准类目）、name（name或者props.name）查找
    var propMapping = {};
    //如果存在类目，则根据类目查找对应的标准目录映射。
    if(currentItem.category && currentItem.category.trim().length>0){//注意：仅对于存在类目的情况有效
        $.ajax({
            url:"https://data.shouxinjk.net/ilife/a/mod/platformProperty/rest/mapping?platform="+currentItem.source+"&category="+currentItem.category,
            type:"get",
            async: false,//同步调用
            success:function(result){
                if(_sxdebug)console.log("got prop mappings.",result);
                if(result.success && result.data && result.data.length>0){
                    result.data.forEach((item, index) => {//将其他元素加入
                      if(_sxdebug)console.log("foreach props.[index]"+index,item);
                      propMapping[item.name.replace(/\./g,"_")]=item.mappingName;
                    });   
                    if(_sxdebug)console.log("got property mapping.",propMapping);  
                }else{
                    if(_sxdebug)console.log("no property mapping returned.");  
                }
            }
        });
    }
    //根据categoryId获取所有measure清单，字段包括name、property
    $.ajax({
        url:"https://data.shouxinjk.net/ilife/a/mod/measure/measures?category="+categoryId,
        type:"get",
        data:{},
        success:function(items){
            if(_sxdebug)console.log(items);
            //在回调内：1，根据返回结果组装待展示数据，字段包括：name、property、value、flag(如果在则为0，不在为1)
            //var props = currentItem.props?currentItem.props:[];//临时记录当前stuff的属性列表
            var props = [];//注意：由于采集脚本中props存在 对象 和 数组两种情况，此处需要进行处理：统一转换为数组
            if(Array.isArray(currentItem.props)){
                props = currentItem.props;
            }else{//将对象转换为Array
                for(propKey in currentItem.props){
                    var kv = {};
                    kv[propKey] = currentItem.props[propKey];
                    props.push(kv);
                }
            }
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


//显示tag编辑框
function showTagging(tags){
    var moreTags = tags;
    //**
    for(var i=0;i<moreTags.length;i++){
        if(moreTags[i].trim().length>0)
            $('#tagging').append("<li>"+moreTags[i]+"</li>");
    }

    var eventTags = $('#tagging');

    var addEvent = function(text) {
        if(_sxdebug)console.log(text);
        //$('#events_container').append(text + '<br>');
    };

    eventTags.tagit({
        availableTags: moreTags,//TODO: 可以获取所有标签用于自动补全
        //**
        beforeTagAdded: function(evt, ui) {
            if (!ui.duringInitialization) {
                addEvent('beforeTagAdded: ' + eventTags.tagit('tagLabel', ui.tag));
            }
        },//**/
        afterTagAdded: function(evt, ui) {
            if (!ui.duringInitialization) {
                if(!currentItem.tagging)
                    currentItem.tagging = "";
                currentItem.tagging += " "+eventTags.tagit('tagLabel', ui.tag);
                //currentItem.tagging.push(eventTags.tagit('tagLabel', ui.tag));
                addEvent('afterTagAdded: ' + eventTags.tagit('tagLabel', ui.tag));
            }
        },
        //**
        beforeTagRemoved: function(evt, ui) {
            addEvent('beforeTagRemoved: ' + eventTags.tagit('tagLabel', ui.tag));
        },//**/
        afterTagRemoved: function(evt, ui) {
            if(!currentItem.tagging)
                currentItem.tagging = "";
            currentItem.tagging = currentItem.tagging.replace(eventTags.tagit('tagLabel', ui.tag),"").trim();
            addEvent('afterTagRemoved: ' + eventTags.tagit('tagLabel', ui.tag));
        },
        /**
        onTagClicked: function(evt, ui) {
            addEvent('onTagClicked: ' + eventTags.tagit('tagLabel', ui.tag));
        },//**/
        onTagExists: function(evt, ui) {
            addEvent('onTagExists: ' + eventTags.tagit('tagLabel', ui.existingTag));
        }
    });   

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
            //fn(result);
            $.toast({
                heading: 'Success',
                text: '更新成功',
                showHideTransition: 'fade',
                icon: 'success'
            });
            window.location.href="index.html"+(showAllItems?"?showAllItems=true":"");
        }
    })            
}

//检查工具面板显示状态
function checkToolbarStatus(){
    if(_sxdebug)console.log("try to check toolbar status..."); 
    var sxToolbarStatus = {};
    if($.cookie('sxToolbarStatus') && $.cookie('sxToolbarStatus').trim().length>0){
        sxToolbarStatus = JSON.parse($.cookie('sxToolbarStatus') );
    } 
    if(_sxdebug)console.log("try to post toolbar  status to parent document.",sxToolbarStatus);   
    window.parent.postMessage({
        sxCookie:{
            action: 'return',
            key:'sxToolbarStatus',
            value:sxToolbarStatus
        }
    }, '*');    
}

//监听postMessage事件：在工具条发生变化时，将状态写入cookie
function listenPostMessage(){
    if(_sxdebug)console.log("child window start listening....");
    var eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
    var eventer = window[eventMethod];
    var messageEvent = eventMethod == "attachEvent" ? "onmessage" : "message";

    // Listen to message from child window
    eventer(messageEvent,function(e) {
        var key = e.message ? "message" : "data";
        var data = e[key];
        if(_sxdebug)console.log("got message from parent window.",data);
        if(data&&data.sxCookie){//实现缓存数据交换
            var sxCookie  = data.sxCookie;
            if (sxCookie.action == 'set'){//存数据到cookie
                //直接写入cookie：键值包括sxToolbarStatus
                if(_sxdebug)console.log("save cookie",sxCookie);
                document.cookie = sxCookie.key+"="+JSON.stringify(sxCookie.value)+"; SameSite=None; Secure";
                //由于窗口显示变化，需要设置是否加载数据标志
                if(sxCookie.key == 'sxToolbarStatus'){//根据状态设置是否加载数据
                  if(sxCookie.value.show){//展示面板，则设置数据等待加载
                      loading = false;
                  }else{
                      loading = true;
                  }
                }
            }else if (sxCookie.action == 'get') {//从cookie读取数据并返回上层窗口
                if(_sxdebug)console.log("try to post message to parent document.",data);
                window.parent.postMessage({
                    sxCookie:{
                        action: 'return',
                        key:sxCookie.key,
                        value:$.cookie(sxCookie.key)?JSON.parse($.cookie(sxCookie.key)):{}
                        //value:window.localStorage.getItem(sxCookie.key)?JSON.parse(window.localStorage.getItem(sxCookie.key)):{}
                    }
                }, '*');
            }else if (sxCookie.action == 'save') {//存储数据到sxPendingItem
                if(_sxdebug)console.log("try to save data to cookie.",sxCookie);
                if(sxCookie.key == 'sxPendingItem'){
                    if(_sxdebug)console.log("check sxPendingItem exists.",sxCookie.value);
                    /**
                    //从cookie获取已有数据
                    var pendingItems = [];//默认为空数组
                    if($.cookie('sxPendingItem') && $.cookie('sxPendingItem').trim().length>2 ){
                        pendingItems = JSON.parse($.cookie('sxPendingItem'));
                    }

                    //检查是否已经在队列里
                    var index = items.findIndex(item => {
                        return item._key == sxCookie.value._key;
                    });
                                        //**/

                    //如果已经存在则直接忽略
                    //if(index<0){//如果不存在则加入队列
                        //pendingItems.push(sxCookie.value);
                        //items.push(sxCookie.value);//加入当前队列中
                        //loading=false;//继续加载

                        //直接用最新数据更换缓存内容
                        currentItem = sxCookie.value;
                        //写入cookie：注意：cookie尺寸很只有4096字节，仅存储最后一个
                        if(_sxdebug)console.log("save sxPendingItem to cookie.",sxCookie.value);
                        document.cookie = "sxPendingItem="+JSON.stringify(sxCookie.value)+"; SameSite=None; Secure";  
                        //显示到界面，注意只需要加载一次即可                        
                        if(!isCollected){//仅展示一次
                            loadItem(hex_md5(currentItem.url));//默认认为是新采集的条目，生成新的key
                            isCollected = true;
                        }

              
                    //}
                }
            };
        }
    },false);
}

//查询单个条目：要复用服务器端已经标注的数据，避免重复劳动
function loadItem(key){//获取内容列表
    $.ajax({
        url:"https://data.shouxinjk.net/_db/sea/my/stuff/"+key,
        type:"get",
        data:{},
        success:function(data){
            //存入cookie，在切换界面时直接读取
            document.cookie = "sxPendingItem="+JSON.stringify(data)+"; SameSite=None; Secure"; 
            showContent(data);
        },
        error: function(xhr){
            //超时后直接尝试显示本地内容
            if(_sxdebug)console.log('load item error. show local item. [status] ' + xhr.status, xhr.statusText);
            showContent();
        },
        timeout: 3000 // sets timeout to 3 seconds
    })            
}

//显示数据到界面
function showContent(item){
    if(item && item._key)//如果查询到有已经存在的内容，则使用该内容
        currentItem = item;
    insertItem(currentItem);//显示当前采集的内容条目
    //以下显示标注表单
    loadCategories();//显示类目选择器
    //注册批量更新stuff类目按钮
    $("#btnBatchUpdateStuff").click(function(){
        batchUpdateStuffCategory(item);//根据当前设置批量修改其他同类目stuff
        //batchUpdatePlatformCategories(item);//根据当前设置批量修改其他同类目platform_categories
    });    
    //隐藏等待提示
    $("#loadingTipDiv").css("display","none");
    //设置标注表单
    $("#title").val(currentItem.title);
    $("#summary").val(currentItem.summary);
    //显示标注表单
    $("#labelingFormDiv").css("display","block");
    //显示标签列表，如果为空则用默认tags
    var tags = currentItem.tags?currentItem.tags:[];
    if(currentItem.tagging && currentItem.tagging.trim().length>0)
        tags = currentItem.tagging.trim().split(" ")
    showTagging(tags);    
}

function submitItemForm(){
    //获取变化的数据
    currentItem.title = $("#title").val();
    currentItem.summary = $("#summary").val();
    currentItem.title = $("#title").val();

    //添加当前采集达人数据，包括openid及orgnnzation信息
    if($.cookie("sxAuth") && $.cookie("sxAuth").trim().length>0){
        var sxAuth = JSON.parse($.cookie("sxAuth"));
        if(sxAuth.openid){
            currentItem.task.user = sxAuth.openid;
        }
    }

    //添加orgnnzation信息
    if($.cookie("sxBrokerInfo") && $.cookie("sxBrokerInfo").trim().length>0){
        var sxBrokerInfo = JSON.parse($.cookie("sxBrokerInfo"));
        if(sxBrokerInfo.orgnization){
            currentItem.task.orgnization = sxBrokerInfo.orgnization.id;
        }
    }

    //仅提交标注数据，其他数据不做提交，避免覆盖服务器侧数据更新
    var changedItem = {
        _key:currentItem._key?currentItem._key:hex_md5(currentItem.url),
        task:{
            user:currentItem.task.user
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
    logstash(currentItem,"toolbar","collect",currentItem.task.user,broker.id,function(){
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
            //fn(result);
            $.toast({
                heading: 'Success',
                text: '提交成功',
                showHideTransition: 'fade',
                icon: 'success'
            });
            //切换到来源页面，便于进入其他站点继续采集数据
        }
    });

    //同时将当前的类目映射添加到platform_categories
    if(currentItem.meta && currentItem.meta.category){
        var platform_category = {
            _key:hex_md5(currentItem.source+currentItem.category),
            source:currentItem.source,
            name:currentItem.category,
            mappingId:currentItem.meta.category,
            mappingName:currentItem.meta.categoryName
        };
        console.log("try to commit platform category.",platform_category);
        $.ajax({
            url:"https://data.shouxinjk.net/_db/sea/category/platform_categories",
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

//加载支持的数据源列表，并显示到界面
function loadPlatformSources(){
    var query={
            collection: "platforms", 
            example: { 
                status:"ready"//查询状态为ready的链接列表
            },
            limit:100
        };   
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    }; 
    util.AJAX(app.config.data_api+"/_api/simple/by-example", function (res) {
        //showloading(false);
        if(_sxdebug)console.log("try to retrive platforms.", res);
        if(res && res.count==0){//如果没有则表示有问题
            if(_sxdebug)console.log("something wrong. we cannot get platforms");
            insertPlatforms(null);
        }else{//否则更新关系名称
            if(_sxdebug)console.log('display platforms',res);
            insertPlatforms(res.result);
        }
    }, "PUT",query,header);
}

function insertPlatforms(platforms){
    if(!platforms || platforms.length == 0){
        //显示提示信息
        return;
    }
    platforms.forEach((item, index) => {//逐个显示
      if(_sxdebug)console.log("insert platform.[index]"+index,item);
      var html = '<div id="platform-link-'+index+'"" class="findMoreBtn-show" class="findMoreBtn-show" style="min-width:80px;width:110px;padding-left:10px;padding-right:10px;text-align:center;overflow:hidden;white-space: nowrap;text-overflow: ellipsis;border-color:#fd5638;color:#fd5638;">';
      //html += '<a href="'+item.url+'" target="_new" >';
      html += item.name  +(item.category?" "+item.category:"");
      //html += '</a>';
      html += '</div>';      
      $("#platformList").append(html);

      //注册点击事件
        $("#platform-link-"+index).click(function(){
            if(_sxdebug)console.log("try to redirect.",item.url);
            var msg = {
              sxRedirect:item.url,
              sxTargetWindow:"_new"
            };
            window.parent.postMessage(msg, "*");//不设定origin，直接通过属性区分            
        }); 
    });    
}

//显示标注表单面板
function showLabelingFormDiv(){
    $("#platformListDiv").css("display","none");
    $("#labelingFormDiv").css("display","block");
}

//显示数据源面板
function showPlatformSourceDiv(){
    $("#platformListDiv").css("display","block");
    $("#labelingFormDiv").css("display","none");
}
