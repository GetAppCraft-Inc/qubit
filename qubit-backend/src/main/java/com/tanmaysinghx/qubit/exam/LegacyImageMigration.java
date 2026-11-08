package com.tanmaysinghx.qubit.exam;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.List;
import java.util.Map;

/**
 * One-time move of figures from the old questions.image_data column into question_images.
 * Safe to run on every start: it only touches rows that still have legacy data.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LegacyImageMigration implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        Integer hasColumn = jdbc.queryForObject("""
                select count(*) from information_schema.columns
                where table_schema = database() and table_name = 'questions' and column_name = 'image_data'""", Integer.class);
        if (hasColumn == null || hasColumn == 0) return;

        List<Map<String, Object>> rows = jdbc.queryForList(
                "select id, image_data from questions where image_data is not null and image_id is null");
        for (Map<String, Object> row : rows) {
            String data = (String) row.get("image_data");
            GeneratedKeyHolder key = new GeneratedKeyHolder();
            jdbc.update(con -> {
                PreparedStatement ps = con.prepareStatement("insert into question_images (data) values (?)", Statement.RETURN_GENERATED_KEYS);
                ps.setString(1, data);
                return ps;
            }, key);
            jdbc.update("update questions set image_id = ?, image_data = null where id = ?", key.getKey().longValue(), row.get("id"));
        }
        if (!rows.isEmpty()) log.info("Moved {} question figure(s) to question_images", rows.size());
    }
}
