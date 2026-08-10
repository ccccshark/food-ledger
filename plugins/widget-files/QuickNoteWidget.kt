package __PACKAGE__

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import org.json.JSONObject
import java.io.File
import java.text.DecimalFormat

/**
 * 味笺桌面小组件：极简手帐便签，显示今日餐费，点击快速记账。
 * 数据来源：应用 filesDir/widget_data.json（由 JS 端 expo-file-system 写入）
 */
class QuickNoteWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) {
            updateWidget(context, appWidgetManager, id)
        }
    }

    /**
     * 外部调用入口：JS 端数据变化后可通过广播触发小组件刷新。
     */
    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == "com.foodledger.app.WIDGET_UPDATE") {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(android.content.ComponentName(context, QuickNoteWidget::class.java))
            for (id in ids) {
                updateWidget(context, manager, id)
            }
        }
    }

    private fun updateWidget(context: Context, manager: AppWidgetManager, id: Int) {
        val views = RemoteViews(context.packageName, R.layout.widget_layout)
        val data = readWidgetData(context)

        val fmt = DecimalFormat("0.00")
        views.setTextViewText(R.id.widget_amount, "¥${fmt.format(data.total)}")
        views.setTextViewText(R.id.widget_count, "${data.count} 笔 · ${data.bookName}")
        views.setTextViewText(R.id.widget_label, "味笺 · 今日")

        // 点击跳转到记账页（deeplink: foodledger://add）
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("foodledger://add"))
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        val pi = PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_root, pi)

        manager.updateAppWidget(id, views)
    }

    private data class WidgetData(val total: Double, val count: Int, val bookName: String)

    private fun readWidgetData(context: Context): WidgetData {
        return try {
            val file = File(context.filesDir, "widget_data.json")
            if (file.exists()) {
                val json = JSONObject(file.readText())
                WidgetData(
                    json.optDouble("todayTotal", 0.0),
                    json.optInt("todayCount", 0),
                    json.optString("bookName", "味笺")
                )
            } else {
                WidgetData(0.0, 0, "味笺")
            }
        } catch (e: Exception) {
            WidgetData(0.0, 0, "味笺")
        }
    }
}
