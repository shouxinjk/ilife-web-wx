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
    //显示加载状态
    showloading(true);
    //处理参数
    var args = getQuery();//获取参数
    //category = args["category"]?args["category"]:0; //如果是跳转，需要获取当前目录
    $('#waterfall').NewWaterfall({
        width: width-20,
        delay: 100,
    });

    $("body").css("background-color","#fff");//更改body背景为白色

    util.getUserInfo();//从本地加载cookie
    //设置浏览用户
    if(app.globalData.userInfo){
        persons.push(app.globalData.userInfo);
        personKeys.push(app.globalData.userInfo._key);
        currentPerson = app.globalData.userInfo._key;
    }
    loadPersons();//加载用户
    loadFeeds();
    //loadData();//加载数据：默认使用当前用户查询

});

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
var currentPerson = app.globalData.userInfo?app.globalData.userInfo._key:'0';
var personKeys = [];//标记已经加载的用户key，用于排重

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

//load feeds
function loadData() {
    console.log("Feed::loadData", currentPerson);
    //设置query
    var esQuery = {//搜索控制
      from: (page.current + 1) * page.size,
      size: page.size,
      query: {
        bool: {
          must: [
            {
              "match": {
                "userId": currentPerson
              }
            }
          ]
        }
      },
      collapse: {
        field: "itemId"//根据itemId 折叠，即：一个item仅显示一次
      },
      sort: [
        { "weight": { order: "desc" } },//权重高的优先显示
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
        success:function(data){
            console.log("Feed::loadData success.",data);
            if(data.hits.hits.length==0){//如果没有内容，则显示提示文字
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
                    items.push(hits[i]._source.item);
                }
                insertItem();
                showloading(false);
            }
        }
    });
  }

//load related persons
function loadPersons() {
    util.AJAX(app.config.data_api+"/user/users", function (res) {
      var arr = res;
      //从列表内过滤掉当前用户：当前用户永远排在第一个
      if (app.globalData.userInfo != null && personKeys.indexOf(u._key) < 0){
          persons.push(app.globalData.userInfo);
          personKeys.push(app.globalData.userInfo._key);
        }
      for (var i = 0; i < arr.length; i++) {
        var u = arr[i];
        if(personKeys.indexOf(u._key) < 0){
          persons.push(u);
          personKeys.push(u._key);
        }
      }
      //将用户显示到页面
      for (var i = 0; i < persons.length; i++) {
        insertPerson(persons[i]);
      }  
      //将当前用户设为高亮  
      //显示滑动条
      var mySwiper = new Swiper ('.swiper-container', {
          slidesPerView: 7,
      });  
      //调整swiper 风格，使之悬浮显示
      $(".swiper-container").css("position","fixed");
      $(".swiper-container").css("left","0");
      $(".swiper-container").css("top","0");
      $(".swiper-container").css("z-index","999");
      $(".swiper-container").css("background-color","#fff");
      $(".swiper-container").css("margin-bottom","5px");
      //注册点击事件：点击后【当前该事件在移动端不生效，直接使用jquery点击事件】
      /*
      mySwiper.on('tap', function (e) {
            personId = e.path[1].id;//注意：如果结构改变需要调整path取值
          console.log('try to change person by tab.',e.path[1].id,e);
          changePerson(personId);
      });   
      //*/      
      //根据当前用户加载数据
      changePerson(currentPerson);     
    });
}

//将person显示到页面
/*
<view class="person">
      <image class="person-img{{person._key==currentPerson?'-selected':''}}" src="{{person.avatarUrl}}" bindtap="changePerson" data-id="{{person._key}}"/>
      <view class="person-name">{{person.nickName}}</view>
</view>
*/
function insertPerson(person){
    // 显示HTML
    var html = '';
    html += '<div class="swiper-slide">';
    html += '<div class="person" id="'+person._key+'">';
    var style= person._key==currentPerson?'-selected':'';
    html += '<img class="person-img'+style+'" src="'+person.avatarUrl+'"/>';
    html += '<div class="person-name">'+person.nickName+'</div>';
    html += '</div>';
    html += '</div>';
    $("#persons").append(html);

    //注册事件:点击后切换用户
    //通过jquery事件注入
    $("#"+person._key).click(function(e){
        console.log("try to change person by jQuery click event.",person._key,e.currentTarget.id,e);
        changePerson(e.currentTarget.id);
    });
}

//显示没有更多内容
function shownomore(flag){
  if(flag){
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

//将item显示到页面
function insertItem(){
    var item = items[num-1];//从本地取一条item
    console.log("Feed::insertItem add item to html.",num,item);
    if(item == null)return;
    var html = '';
    html += '<li><div class="WxMasonry">';
    html += '<div id="item'+item._key+'">';
    html += htmlItemImage(item);
    html += htmlItemSummary(item);
    html += htmlItemTags(item);
    html += '</div>';
    html += '</div></li>';
    $("#waterfall").append(html);

    //注册事件
    $("#item"+item._key).click(function(){
        //跳转到详情页
        window.location.href = "info2.html?id="+item._key;
    });
    // 表示加载结束
    showloading(false);
    loading = false;
    num++;
}

function htmlItemImage(item){
    var html = '';
    html += '<div class="mainbody">';
    html += '<img class="WxMasonryImage" id="'+item._key+'" src="'+item.images[0]+'" width="100%" height="200px" />';
    html += '</div>';
    return html;
}

function htmlItemSummary(item){
    var html = '';
    html += '<div class="shopping">';
    html += '<div class="shopping-summary">';
    if(item.source.length>0){
        html += '<img class="shopping-icon" class="shopping-icon" src="http://www.shouxinjk.net/list/images/source/'+item.source+'.png"/>';
    }
    if(item.distributor.name.length>0){
        html += '<text class="box-title">'+item.distributor.name+'</text>';
    }
    html += '</div>';
    html += '<div class="likes">';
    if(item.price.currency){
        html += '<text class="currency">'+item.price.currency+'</text>';
    }else{
        html += '<text class="currency">¥</text>';
    }
    html += '<text class="price-sale">'+item.price.sale+'</text>';
    if(item.price.bid){
        html += '<text class="price-bid">/</text>';
        html += '<text class="price-bid">'+item.price.bid+'</text>';
    }
    html += '</div>';
    html += '</div> ';
    return html;
}

function htmlItemTags(item){
    var html = '';
    html += '<div class="list-box">';
    html += '<div class="main-item">';
    html += '<div class="list-box-title">'+item.title+'</div>';
    if(item.tags.length>0){
        html += '<div class="tags">';
        for(var i=0;i<item.tags.length;i++){
            if(item.tags[i].trim().length>0){
                html += '<div class="tag-text">#'+item.tags[i]+'</div>';
            }
        }
        html += '</div>';
    }
    html += '</div>';
    html += '</div>';
    return html;
}

function changePerson (personId) {
    var ids = personId;
    if (app.globalData.isDebug) console.log("Feed::ChangePerson change person.",currentPerson,personId);
    $("#"+currentPerson+" img").removeClass("person-img-selected");
    $("#"+currentPerson+" img").addClass("person-img");
    $("#"+ids+" img").removeClass("person-img");
    $("#"+ids+" img").addClass("person-img-selected");
    $("#waterfall").empty();//清空原有列表
    $("#waterfall").css("height","20px");//调整瀑布流高度
    showloading(true);//显示加载状态

    page.current = -1;//从第一页开始查看
    currentPerson = ids;//修改当前用户
    items = [];//清空列表
    num = 1;//从第一条开始加载
    loadData();//重新加载数据
  }




