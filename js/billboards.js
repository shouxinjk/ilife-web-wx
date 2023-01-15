// 文档加载完毕后执行
$(document).ready(function ()
{
        //根据屏幕大小计算字体大小
    const oHtml = document.getElementsByTagName('html')[0]
    width = oHtml.clientWidth;
    var rootFontSize = 12 * (width / 1440);// 在1440px的屏幕基准像素为12px
    rootFontSize = rootFontSize <8 ? 8:rootFontSize;//最小为8px
    rootFontSize = rootFontSize >16 ? 16:rootFontSize;//最大为18px
    oHtml.style.fontSize = rootFontSize+ "px";   
    //计算图片流宽度：根据屏幕宽度计算，最小显示2列
    /**
    if(width < 2*columnWidth){//如果屏幕不能并排2列，则调整图片宽度
        columnWidth = (width-columnMargin*4)/2;//由于每一个图片左右均留白，故2列有4个留白
    }    
    //**/
    //显示加载状态
    showloading(true);
    //处理参数
    var args = getQuery();//获取参数
    //category = args["category"]?args["category"]:0; //如果是跳转，需要获取当前目录
    if(args["id"])inputPerson=args["id"];//从请求中获取需要展示的person或personaId
    if(args["categoryId"])categoryId=args["categoryId"];//如果传递则使用传递进入的categoryId
    //初始化瀑布流
    $('#waterfall').NewWaterfall({
        width: width-20,//1列
        //width: columnWidth,//动态列宽，当前为2列
        delay: 100,
    });

    $("body").css("background-color","#fff");//更改body背景为白色

    util.getUserInfo();//从本地加载cookie

    //加载所有类目列表：注意是包含有排行榜的类目
    loadCategories();  //加载完成后将自动开始装载条目

    loadFeeds();//加载排行榜列表   

    //加载broker信息
    loadBrokerInfo(); 
});

var width = 600;
var clientWidth = 600;

var columnWidth = 300;//默认宽度300px
var columnMargin = 5;//默认留白5px

var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var items = [];
var page = {//翻页控制
  size: 20,//每页条数
  total: 1,//总页数
  current: -1//当前翻页
};

var persons = [];
var currentPerson = app.globalData.userInfo?app.globalData.userInfo._key:JSON.parse($.cookie('sxUserInfo'))._key;//本地加载当前用户
var currentPersonTagging = "";//记录当前用户的标签清单，用于根据标签显示内容
var currentPersonType = "person";//当前选中的是用户还是画像，默认进入时显示当前用户
var personKeys = [];//标记已经加载的用户key，用于排重

var categoryId = null;

var inputPerson = null;//接收指定的personId或personaId

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

//临时用户
var tmpUser = "";
//优先从cookie加载达人信息
var broker = {
  id:"system"
};//当前达人
function loadBrokerInfo(){
  broker = util.getBrokerInfo();
}

//load person
function loadPerson(personId) {
    console.log("try to load person info.",personId);
    util.AJAX(app.config.data_api+"/user/users/"+personId, function (res) {
        console.log("load person info.",personId,res);
        syncPerson(res);//提交用户昵称到后端
        //loadBrokerByOpenid(res._key);//根据openid加载broker信息
    });
}
//同步用户信息：将用户昵称及头像同步到后台
function syncPerson(person){
    //同时更新broker的nickname及avatarUrl：由于微信不能静默获取，导致broker内缺乏nickname及avatarUrl
    console.log("try to sync broker info.",person);
    $.ajax({
        url:app.config.sx_api+"/mod/broker/rest/sync/"+person._key,
        type:"post",
        data:JSON.stringify({
            nickname: person.nickName,
            avatarUrl:person.avatarUrl
        }),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },
        success:function(res){
            console.log("sync success.",res);
        },
        error:function(){
            console.log("sync failed.",person);
        }
    });     
}


//加载阶段列表：一次加载全部，用于顶部滑动条
var categories = [];
function loadCategories() {
    util.AJAX(app.config.sx_api+"/mod/itemCategory/rest/rank-categories", function (res) {
        console.log("got categories.",res);
        categories = res;
        showSwiper();    
    });
}
//显示滑动条
function showSwiper(){
    //装载到页面
    categories.forEach(function(item){
        if(item.id != "1") //排除根节点
            insertCategoryItem(item);
    });
  
    //显示滑动条
    var mySwiper = new Swiper ('.swiper-container', {
        slidesPerView: 7,
    });  
    //调整swiper 风格，使之悬浮显示
    /**
    $(".swiper-container").css("position","fixed");
    $(".swiper-container").css("left","0");
    $(".swiper-container").css("top","0");
    $(".swiper-container").css("z-index","999");
    $(".swiper-container").css("background-color","#fff");
    //$(".swiper-container").css("margin-bottom","3px");
    //**/
  
    //将当前选中条目设为高亮  
    if(categoryId){//有指定Id则直接高亮
        var category = categories.find(item => item.id == categoryId);
        if(category){
            changeCategory(category);
        }else{
            console.log("cannot find category by id.",$(this).data("id"));
        }         
    }
  
}

//显示滑动条显示元素：category，包括LOGO及名称
function insertCategoryItem(category){
    //logo
    var logo = "http://www.shouxinjk.net/static/logo/distributor/ilife.png";
    if(category.logo && category.logo.indexOf("http")>-1){
        logo = category.logo;
    }else if(category.logo && category.logo.trim().length>0){
        logo = "http://www.shouxinjk.net/static/logo/category/"+category.logo;
    }
    // 显示HTML
    var html = '';
    html += '<div class="swiper-slide">';
    html += '<div class="person" id="'+category.id+'" data-id="'+category.id+'">';
    var style = category.id==categoryId?'-selected':'';
    html += '<div class="person-img-wrapper"><img class="person-img'+style+'" src="'+logo+'"/></div>';
    html += '<span class="person-name">'+category.name+'</span>';
    html += '</div>';
    html += '</div>';
    $("#categories").append(html);

    //注册事件:点击后切换
    $("#"+category.id).click(function(e){
      console.log("change category.",$(this).data("id"));
      var category = categories.find(item => item.id == $(this).data("id"));
      if(category){
        changeCategory(category);
      }else{
        console.log("cannot find category by id.",$(this).data("id"));
      }
      
    });
}
//切换Category
function changeCategory (category) {
    if(category){ //支持首次无指定类目加载
        console.log("change category.",category);
        $("#"+categoryId+" img").removeClass("person-img-selected");
        $("#"+categoryId+" img").addClass("person-img");
        $("#"+category.id+" img").removeClass("person-img");
        $("#"+category.id+" img").addClass("person-img-selected");

        $("#"+categoryId+" span").removeClass("person-name-selected");
        $("#"+categoryId+" span").addClass("person-name");
        $("#"+category.id+" span").removeClass("person-name");
        $("#"+category.id+" span").addClass("person-name-selected");

        categoryId = category.id;
        categoryName = category.name;
    }

    showloading(true);//显示加载状态
    $("#waterfall").empty();
    items = [];
    page.current = -1;
    num = 1;

    loadData();//重新加载数据
  } 


//加载排行榜定义
var ranks=[];//rank列表，每一个元素均包含rank及rankItem
function loadData(){
    $.ajax({
        url:app.config.sx_api+"/mod/rank/rest/paged-ranks",
        type:"post",
        headers:{
            "Content-Type":"application/json"
        },        
        data:JSON.stringify({
            categoryId:categoryId?categoryId:"",
            from: (page.current + 1) * page.size,
            to: (page.current + 1) * page.size + page.size
        }),
        success:function(ret){
            console.log("===got items===\n",ret);
            if(ret.length>0){
                page.current = page.current + 1;
                ret.forEach(function(item){
                    if(items.find(entry => entry.id == item.id)){ //排重
                        //do nothing
                    }else{
                        items.push(item);
                    }
                });  
                insertItem();
                showloading(false);
            }else{
                shownomore(true);
                showloading(false);                
            }
        }
    });     
}

//排行榜设置模板
var rankTpl = `
    <div id="rank__id" data-id="__id" style="display:flex;flex-direction: row;flex-wrap: nowrap;width:100%;padding:5px;align-items: center;justify-content: center;">
        <div style="width:20%;text-align:center;">
            <img src="__logo" style="width:60px;height:60px;object-fit: cover;border-radius: 10px;"/>
        </div>
        <div style="width:76%">
            <div>
                <div id="rankCategoryName__id" style="font-size:14px;line-height:16px;font-weight:bold;">__categoryName</div>
                <div id="rankKeywrod__id" style="font-size:10px;line-height:16px;">__keyword</div>
            </div>
            <div id="rankName__id" style="font-size:18px;line-height:24px;font-weight:bold;;">__name</div>
            <div id="rankDesc__id" style="font-size:12px;line-height:16px;;">__desc</div>
            <!--排序规则:显示为grid-->   
            <div id="rankItems__id">
                
            </div>                
        </div>
    </div> 
`;
//排行榜排序条目模板
var rankItemTpl = `
  <div class="element-item post-transition metal " id="rankItem__dimensionid" data-dimensionid="__dimensionid" data-priority="__priority" data-bgcolor="__bgcolor" style="background-color:__bgcolor">
    <h5 class="name" style="font-size:10px;">__name</h5>
    <p class="symbol" data-sort="__sort" id="sort__dimensionid">__sort</p>
    <p class="number">__weight</p>
  </div>
`;
var colors = ['#8b0000', '#dc143c', '#ff4500', '#ff6347', '#1e90ff','#40e0d0','#0dbf8c','#9acd32','#32cd32','#228b22','#067633'];
var weightSum=0;//由于参与排行的维度数量会变化，需要重新计算
//显示排行榜条目
function insertItem(){
    // 加载内容
    var rank = items[num-1];
    console.log("try insert rank item.",rank);
    if(!rank){
      shownomore(true);
      return;
    }

    //logo
    var logo = "http://www.shouxinjk.net/static/logo/distributor/ilife.png";
    if(rank.category.logo && rank.category.logo.indexOf("http")>-1){
        logo = rank.category.logo;
    }else if(rank.category.logo && rank.category.logo.trim().length>0){
        logo = "http://www.shouxinjk.net/static/logo/category/"+rank.category.logo;
    }
    //基本信息
    var rankHtml = rankTpl.replace(/__id/g,rank.id).replace(/__name/g,rank.name).replace(/__categoryName/g,rank.category.name)
                .replace(/__keyword/g,rank.keyword?rank.keyword:"").replace(/__desc/g,rank.description).replace(/__logo/g,logo);
    $("#waterfall").append(rankHtml);

    //注册事件
    $("#rank"+rank.id).click(function(){
        //跳转到详情页
        window.location.href = "billboard.html?rankId="+$(this).data("id");
    });

    //显示排行规则
    $("#rankItems"+rank.id).empty();//先清空
    if(rank.items){
      console.log("show rank items.",rank.items);
      var weightSum = 0;
      rank.items.forEach(function(rankItem){
        weightSum += rankItem.dimension.weight;
      });
      var i=0;
      rank.items.forEach(function(rankItem){
        var dimension = rankItem.dimension;
        var rankItemHtml = rankItemTpl;
        rankItemHtml = rankItemHtml.replace(/__dimensionid/g,dimension.id);
        rankItemHtml = rankItemHtml.replace(/__name/g,dimension.name);
        rankItemHtml = rankItemHtml.replace(/__priority/g,rankItem.priority);
        rankItemHtml = rankItemHtml.replace(/__sort/g,(i+1));
        rankItemHtml = rankItemHtml.replace(/__weight/g,Number((dimension.weight/weightSum*100).toFixed(0))+"%");
        rankItemHtml = rankItemHtml.replace(/__bgcolor/g,colors[i]);//使用缓存颜色
        $("#rankItems"+rank.id).append(rankItemHtml);
        i++;
      });
    }

    // 表示加载结束
    showloading(false);
    loading = false;    
    num++; 

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
    //注册跳转事件：跳转到推荐页，需要带有当前用户ID
    $("#findMoreBtn").click(function(){
      window.location.href = "index.html?keyword="+categoryName;
    });    
  }else{
    $("#findMoreBtn").toggleClass("findMoreBtn-hide",true);
    $("#findMoreBtn").toggleClass("findMoreBtn-show",false);
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


// 自动加载更多：此处用于测试，动态调整图片高度
function random(min, max)
{
    return min + Math.floor(Math.random() * (max - min + 1))
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
    var shareUrl = window.location.href.replace(/measures/g,"share");//需要使用中间页进行跳转
    if(shareUrl.indexOf("?")>0){//如果本身带有参数，则加入到尾部
        shareUrl += "&fromUser="+shareUserId;
        shareUrl += "&fromBroker="+shareBrokerId;
    }else{//否则作为第一个参数增加
        shareUrl += "?fromUser="+shareUserId;
        shareUrl += "&fromBroker="+shareBrokerId;        
    }
    //添加categoryId
    if(categoryId && categoryId.trim().length>0){
      shareUrl += "&categoryId="+categoryId;
    }
    shareUrl += "&origin=measures";//添加源，表示是一个列表页分享

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
                    title:(categoryName&&categoryName.trim().length>0?categoryName:"小确幸大生活")+"排行榜", // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg", // 分享图标
                    success: function () {
                        // 用户点击了分享后执行的回调函数
                        //TODO: solution分享当前不记录
                        /*
                        logstash(stuff,"mp","share timeline",shareUserId,shareBrokerId,function(res){
                            console.log("分享到朋友圈",res);
                        }); 
                        //**/
                    },
                });
                //分享给朋友
                wx.onMenuShareAppMessage({
                    title:(categoryName&&categoryName.trim().length>0?categoryName:"小确幸大生活")+"排行榜", // 分享标题
                    desc:"完整的评价体系，全面的数据，发现更多更真实的信息", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: "http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg", // 分享图标
                    type: 'link', // 分享类型,music、video或link，不填默认为link
                    dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
                    success: function () {
                      // 用户点击了分享后执行的回调函数
                      //TODO:solution分享当前不记录
                      /**
                        logstash(stuff,"mp","share appmsg",shareUserId,shareBrokerId,function(res){
                            console.log("分享到微信",res);
                        }); 
                        //**/
                    }
                });   
                //分享到朋友圈
                wx.updateTimelineShareData({
                    title:(categoryName&&categoryName.trim().length>0?categoryName:"小确幸大生活")+"排行榜", // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg", // 分享图标
                    success: function () {
                        // 用户点击了分享后执行的回调函数
                        //TODO: solution分享当前不记录
                        /*
                        logstash(stuff,"mp","share timeline",shareUserId,shareBrokerId,function(res){
                            console.log("分享到朋友圈",res);
                        }); 
                        //**/
                    },
                });
                //分享给朋友
                wx.updateAppMessageShareData({
                    title:(categoryName&&categoryName.trim().length>0?categoryName:"小确幸大生活")+"排行榜", // 分享标题
                    desc:"完整的评价体系，全面的数据，发现更多更真实的信息", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: "http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg", // 分享图标
                    type: 'link', // 分享类型,music、video或link，不填默认为link
                    dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
                    success: function () {
                      // 用户点击了分享后执行的回调函数
                      //TODO:solution分享当前不记录
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
