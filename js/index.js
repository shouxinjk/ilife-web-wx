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
        columnWidth = (width-columnMargin*4)/2;//由于每一个图片左右均留白，故2列有4个留白
    }
    var args = getQuery();//获取参数
    $('#waterfall').NewWaterfall({
        width: columnWidth,
        delay: 100,
    });
    category = args["category"]?args["category"]:0; //如果是跳转，需要获取当前目录
    tagging = args["keyword"]?args["keyword"]:""; //通过搜索跳转
    if(tagging.trim().length>0){
        $(".search input").attr("placeholder"," "+tagging);
    }
    loadCategories(category);//加载导航目录
    $(document).keydown(function(event){//注册搜索事件
        if(event.keyCode==13){
            tagging = $(".search input").val().trim();
            window.location.href="index.html?keyword="+tagging;
        }
    });
});

var columnWidth = 300;//默认宽度300px
var columnMargin = 5;//默认留白5px

var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var items = [];//所有内容列表
var category  = 0; //当前目录ID
var tagging = ""; //当前目录关联的查询关键词，搜索时直接通过该字段而不是category进行

var page = {
    size:20,//每页条数
    total:1,//总页数
    current:-1//当前翻页
};

var esQuery={
    from:0,
    size:page.size,
    query: {
        match_all: {}
    },
    sort: [
        { "@timestamp": { order: "desc" }},
        { "_score":   { order: "desc" }}
    ]
};

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

function loadItems(){//获取内容列表
    var q={
        match: { 
          full_text:"" 
        }
    };    
    if(tagging.trim().length>0){//使用指定内容进行搜索
        q.match.full_text = tagging;
        esQuery.query = q;
    }else{//搜索全部
        esQuery.query = {
            match_all: {}
        };
    }
    //处理翻页
    esQuery.from = (page.current+1) * page.size;

    $.ajax({
        url:"https://data.pcitech.cn/stuff/_search",
        type:"post",
        data:JSON.stringify(esQuery),//注意：nginx启用CORS配置后不能直接通过JSON对象传值
        headers:{
            "Content-Type":"application/json",
            "Authorization":"Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
        },
        crossDomain: true,
        success:function(data){
            if(data.hits.hits.length==0){//如果没有内容，则显示提示文字
                showNoMoreMsg();
            }else{
                //更新总页数
                var total = data.hits.total;
                page.total = (total + page.size - 1) / page.size;
                //更新当前翻页
                page.current = page.current + 1;
                //装载具体条目
                var hits = data.hits.hits;
                for(var i = 0 ; i < hits.length ; i++){
                    items.push(hits[i]._source);
                }
                insertItem();
            }
        }
    })
}

/*
function loadItems(){//获取内容列表
    $.ajax({
        url:"https://data.shouxinjk.net/_db/sea/my/stuff",
        type:"get",
        data:{offset:items.length,size:20,category:category},
        success:function(data){
            if(data.length==0){//如果没有内容，则显示提示文字
                showNoMoreMsg();
            }else{
                for(var i = 0 ; i < data.length ; i++){
                    items.push(data[i]);
                }
                insertItem();
            }
        }
    })
}
//*/

//将item显示到页面
function insertItem(){
    // 加载内容
    var item = items[num-1];
    var imgWidth = columnWidth-2*columnMargin;//注意：改尺寸需要根据宽度及留白计算，例如宽度为360，左右留白5，故宽度为350
    var imgHeight = random(50, 300);//随机指定初始值
    //计算图片高度
    var img = new Image();
    img.src = item.images?item.images[0]:"https://www.biglistoflittlethings.com/list/images/logo00.jpeg";
    var orgWidth = img.width;
    var orgHeight = img.height;
    imgHeight = orgHeight/orgWidth*imgWidth;
    //计算文字高度：按照1倍行距计算
    //console.log("orgwidth:"+orgWidth+"orgHeight:"+orgHeight+"width:"+imgWidth+"height:"+imgHeight);
    var image = "<img src='"+item.images[0]+"' width='"+imgWidth+"' height='"+imgHeight+"'/>"
    //var title = "<span class='title'><a href='info.html?category="+category+"&id="+item._key+"'>"+item.title+"</a></span>"
    var title = "<div class='title'>"+item.title+"</div>"
    $("#waterfall").append("<li><div data='"+item._key+"'>" + image +title+ "</div></li>");
    num++;

    //注册事件
    $("div[data='"+item._key+"']").click(function(){
        //跳转到详情页
        window.location.href = "info.html?category="+category+"&id="+item._key;
    });

    // 表示加载结束
    loading = false;
}

//当没有更多item时显示提示信息
function showNoMoreMsg(){
    //todo：显示没有更多toast
    /*
    $.toast({
        heading: 'Success',
        text: '没有更多了',
        showHideTransition: 'fade',
        icon: 'info'
    });   
    //*/
    $("#footer").toggleClass("footer-hide",false);
    $("#footer").toggleClass("footer-show",true);
}

// 自动加载更多：此处用于测试，动态调整图片高度
function random(min, max)
{
    return min + Math.floor(Math.random() * (max - min + 1))
}

function loadCategories(currentCategory){
    $.ajax({
        url:"https://data.shouxinjk.net/_db/sea/category/categories",
        type:"get",
        success:function(msg){
            var navObj = $(".navUl");
            for(var i = 0 ; i < msg.length ; i++){
                navObj.append("<li data='"+msg[i]._key+"' data-tagging='"+(msg[i].tagging?msg[i].tagging:"")+"'>"+msg[i].name+"</li>");
                if(currentCategory == msg[i]._key){//高亮显示当前选中的category
                    $(navObj.find("li")[i]).addClass("showNav");
                    tagging = msg[i].tagging;
                }
            }
            //注册点击事件
            navObj.find("li").click(function(){
                var key = $(this).attr("data");
                var tagging = $(this).attr("data-tagging");
                changeCategory(key,tagging);//更换后更新内容
                $(navObj.find("li")).removeClass("showNav");
                $(this).addClass("showNav");
            })
        }
    })    
}

function changeCategory(key,q){
    category = key;//更改当前category
    tagging = q;//使用当前category对应的查询更新查询字符串
    items = [];//清空列表
    $("#waterfall").empty();//清除页面元素
    num=1;//设置加载内容从第一条开始
    page.current = -1;//设置浏览页面为未开始
    loadItems();//重新加载数据
}