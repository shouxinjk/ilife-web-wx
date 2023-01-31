// 文档加载完毕后执行
$(document).ready(function ()
{
    //当分享单个item时，传递参数包括：fromBroker,fromUser,from,itemId四个，需要获取参数后请求微信静默授权得到openid
    var args = location.search;//获取参数
    console.log("Share::onReady get parameters.",args);

    args = args.replace(/\?/g,"___");
    args = args.replace(/\&/g,"__");
    
    //组织链接，到oauth
    var appid="wxe12f24bb8146b774";
    var redirect_uri="http://www.biglistoflittlethings.com/ilife-web-wx/dispatch.html";//统一通过分发页面跳转

    ////多站点处理：start//////////////////////////////////
    //由于存在多个网站，需要根据toSite参数区分重定向地址：
    /**
    var toSite = getQuery()["toSite"];//获取toSite参数，如果为空则不做处理
    if(toSite && toSite =="shouxinjk"){//如果是京东，则跳转到shouxinjk.net
        redirect_uri="http://www.shouxinjk.net/ilife-web-wx/dispatch.html";
    }
    ////多站点处理：end////////////////////////////////////
    //**/

    var response_type="code";
    var scope="snsapi_base";//静默授权，只需要获取openid

    //var state="info2"+args;//默认是单个商品详情页分享
    var state="go"+args;//默认单品直接跳转到第三方详情页
    //如果origin为board，则跳转到board
    var origin = getQuery()["origin"];//获取origin参数，如果为空则不作处理
    if(origin && origin =="item"){//单品默认直接进入第三方详情界面
        state="go"+args;
    }else if(origin && origin =="board"){//如果是board则调整跳转页面：列表风格
        state="board2"+args;
    }else if(origin && origin =="board-waterfall"){//如果是board则调整跳转页面：瀑布流风格
        state="board2-waterfall"+args;
    }else if(origin && origin =="board-all"){//显示所有清单。达人入口为模板消息
        state="boards"+args;
    }else if(origin && origin =="solution"){//显示所有清单。达人入口为模板消息
        state="solution"+args;
    }else if(origin && origin =="measures"){//进入measure排行榜清单
        state="measures"+args;
    }else{
        state=origin+args; //默认直接跳转
    }


    var oauth_url="https://open.weixin.qq.com/connect/oauth2/authorize"
        +"?appid="+appid
        + "&redirect_uri=" + redirect_uri
        + "&response_type=code&scope=" + scope
        + "&state=" + state
        + "#wechat_redirect";

    console.log("Share::onReady start oauth.",oauth_url);
    window.location.href = oauth_url;
});

