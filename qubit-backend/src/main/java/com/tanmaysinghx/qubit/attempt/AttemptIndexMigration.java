package com.tanmaysinghx.qubit.attempt;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * attempts.registration_id used to be UNIQUE (one attempt per registration, forever). Approved appeals now
 * allow a retake, so the unique index is replaced by a plain one (Hibernate creates idx_attempts_registration).
 * Single-attempt is still enforced in AttemptService under a row lock. Idempotent.
 */
@Slf4j
@Component
@Order(0)
@RequiredArgsConstructor
public class AttemptIndexMigration implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        List<String> unique = jdbc.queryForList("""
                select distinct index_name from information_schema.statistics
                where table_schema = database() and table_name = 'attempts' and column_name = 'registration_id'
                  and non_unique = 0 and index_name <> 'PRIMARY'""", String.class);
        if (unique.isEmpty()) return;
        Integer plain = jdbc.queryForObject("""
                select count(*) from information_schema.statistics
                where table_schema = database() and table_name = 'attempts' and index_name = 'idx_attempts_registration'""", Integer.class);
        if (plain == null || plain == 0) jdbc.execute("create index idx_attempts_registration on attempts (registration_id)");
        for (String idx : unique) {
            jdbc.execute("alter table attempts drop index `" + idx.replace("`", "") + "`");
            log.info("Dropped unique index {} on attempts.registration_id (retakes on appeal)", idx);
        }
    }
}
