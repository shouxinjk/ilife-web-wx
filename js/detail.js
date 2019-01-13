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

    //处理参数
    var args = getQuery();//获取参数
    var id = args["id"]?args["id"]:0; //从参数里获取id

    loadData(id);//加载stuff数据，使用id作为参数
    loadHosts(id);//加载与当前Stuff相关的用户操作清单
});


// 主数据
var userInfo = app.globalData.userInfo;//当前用户，用于分享时或从分享进入引用
var accuracyThreshhold = 0;//根据准确度判定提示用户修正persona，当前不做检查
var item = {};// 内容对象
var actions = []; // 该内容下用户行为列表
var hosts = [];//推荐用户列表
var maxHosts = 5;//最多显示hosts个数

// 状态数据
var data = {
    isLiked: false,
    countLike:0,
    countBuy:0,
    countShare:0,
    countView:0,
    countTotal:0
};


// 根据ID请求Stuff数据
    function loadData(stuff_id){
      util.AJAX(app.config.data_api+"/my/stuff/" + stuff_id, function (data) {
        //var data = res.data;
        console.log("Detail::loadStuff",data);
        item = data;
        //显示内容
        insertItem();
        //记录用户行为
        logstash(item,"mp","view",function(){});
      });
    }

  //根据ID请求Hosts数据
  function loadHosts(stuff_id) {
    console.log("Detail::loadHosts", stuff_id);
    //设置query
    var esQuery = {//搜索控制
      from: 0,
      size: 30,//注意：当前仅固定取20条记录，通过排重后显示
      query: {
        bool: {
          must: [
            {
              "match": {
                "itemId": stuff_id
              }
            }
          ]
        }
      },
      sort: [
        { "weight": { order: "desc" } },
        { "@timestamp": { order: "desc" } },
        { "_score": { order: "desc" } }
      ]
    };
    //设置请求头
    var esHeader = {
      "Content-Type": "application/json",
      "Authorization": "Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
    };
    util.AJAX(app.config.search_api+"/actions/_search", function (res) {
      //console.log("now parsing search result.",res);
      if (res.data.hits.hits.length == 0) {//如果没有内容，则显示提示文字
        //do nothing
      } else {
        var numberOfHosts = 0;
        var arr = res.data.hits.hits;// 获取结果
        var list = [];
        var userIds = [];
        for (var i = 0; i < arr.length; i++) {//将搜索结果放入列表，需要根据用户ID排重
          var record = arr[i]._source;
          var uid = record.user._key;
          if(uid && userIds.indexOf(uid)<0){
            userIds.push(uid);
            list.push(record.user);
            numberOfHosts++;
          }
        }

        //写入数据
        hosts = list;

        //显示到界面
        insertHosts();
      }
    }, "post", JSON.stringify(esQuery), esHeader);
}

//将item显示到页面
function insertItem(){
    console.log("Detail::insertItem add item to html.",item);
    $("#largeImg").append(htmlItemImageSlide(item));//图片幻灯：大图
    $("#smallImg").append(htmlItemImageSlide(item));//图片幻灯：缩略图
    $(".shopping").append(htmlItemSummary(item));//摘要（来源、价格等）
    $(".tags").append(htmlItemTags(item));//标签
    $(".box-title").append(htmlItemTitle(item));//标题
    $(".content").append(htmlItemImage(item));//内容（图片列表）

    //初始化图片幻灯
    var galleryThumbs = new Swiper('.gallery-thumbs', {
      spaceBetween: 1,
      slidesPerView: 5,
      freeMode: true,
      watchSlidesVisibility: true,
      watchSlidesProgress: true,
    });
    var galleryTop = new Swiper('.gallery-top', {
      spaceBetween: 10,
    autoplay: {
        delay: 1000,
      },     
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
      thumbs: {
        swiper: galleryThumbs
      }
    });

}

function insertHosts(){
    if(hosts.length > 0){
        $("#authorlist").append('<text class="list-text">对这个很感兴趣还有</text>');
    }
    if(hosts.length > maxHosts){
        $("#authorlist").append(insertHostFold(item));
    }else{
        $("#authorlist").append(insertHostFlat(item));
    }
}

//平铺显示关联用户
function insertHostFlat(){
    var html = '';
    for(var i=0;i<hosts.length;i++){
        html += '<div class="connections">';
            html += '<div class="list" hover-class="none">';
            html += '<div class="list-icon-wrap">';
            html += '<img src="'+hosts[i].avatarUrl+'" class="list-icon"/>';
            html += '</div>';
            html += '<div class="list-text-wrap">';
            html += '<div class="list-text">'+hosts[i].nickName+'</div>';
            html += '<div class="list-text small">'+hosts[i].city+'</div>';
            html += '</div>';
            html += '</div>';
        html += '</div>';
    }
    return html;
}

//折叠显示关联用户
function insertHostFold(){
    var html = '';
    html += '<div class="menu">';
    html += '<div class="btn-area">';
    for(var i=0;i<hosts.length;i++){
        html += '<div class="person" id="'+hosts[i]._key+'">';
        html += '<img class="person-img" src="'+hosts[i].avatarUrl+'"/>';
        html += '<div class="person-name">'+hosts[i].nickName+'</div>';
        html += '</div>';
    }
    html += '</div>';
    html += '</div>';
    return html;
}

function htmlItemImageSlide(item){
    var html = '';
    for(var i=0;i<item.images.length;i++){
        html += '<div class="swiper-slide">';
        html += '<img src="'+item.images[i]+'" width="100%"/>';
        html += '</div>';
    }
    return html;
}

function htmlItemImage(item){
    var html = '';
    for(var i=0;i<item.images.length;i++){
        //html += '<div class="content">';
        html += '<img class="WxMasonryImage" src="'+item.images[i]+'" width="100%"/>';
        //html += '</div>';
    }
    return html;
}

function htmlItemTitle(item){
    var html = '';
    html += '<div class="box-title">';
    html += '<div class="title"/>'+item.title+'</div>';
    html += '</div>';
    return html;
}

function htmlItemSummary(item){
    var html = '';
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
    return html;
}

function htmlItemTags(item){
    var html = '';
    if(item.tags.length>0){
        //html += '<div class="tags">';
        for(var i=0;i<item.tags.length;i++){
            if(item.tags[i].trim().length>0){
                html += '<div class="tag-text">#'+item.tags[i]+'</div>';
            }
        }
        //html += '</div>';
    }
    return html;
}

